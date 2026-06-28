const { PrismaClient } = require('@prisma/client');
const ClassicScoring = require('../strategies/classicScoring');
const socketManager = require('../websockets/socketManager'); // Import socketManager

const prisma = new PrismaClient();
const classicScoring = new ClassicScoring();

const processMatchResult = async (matchId, homeGoals, awayGoals) => {
  if (homeGoals === undefined || awayGoals === undefined) {
    throw new Error('Actual homeGoals and awayGoals must be provided.');
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch Match and all its Predictions
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: {
        predictions: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!match) {
      throw new Error(`Match with ID ${matchId} not found.`);
    }
    if (match.status === 'FINISHED') {
      throw new Error(`Match with ID ${matchId} has already been processed.`);
    }

    const updatedPredictions = [];
    const affectedUserIds = [];

    for (const prediction of match.predictions) {
      const pointsEarned = classicScoring.calculatePoints(
        prediction.predictedHome,
        prediction.predictedAway,
        homeGoals,
        awayGoals
      );

      // Update prediction
      const updatedPrediction = await tx.prediction.update({
        where: { id: prediction.id },
        data: { pointsEarned: pointsEarned },
      });
      updatedPredictions.push(updatedPrediction);
      affectedUserIds.push(prediction.userId);

      // Update User totalPoints directly
      await tx.user.update({
        where: {
          id: prediction.userId,
        },
        data: {
          totalPoints: {
            increment: pointsEarned,
          },
        },
      });
    }

    // Update Match status and scores
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: 'FINISHED',
        homeGoals: homeGoals,
        awayGoals: awayGoals,
      },
    });

    return { message: `Match ${matchId} results processed successfully.`, affectedUserIds };
  });

  // After transaction, emit leaderboard updates for all leagues associated with affected users
  const memberships = await prisma.leagueMember.findMany({
    where: {
      userId: {
        in: result.affectedUserIds
      }
    },
    select: {
      leagueId: true
    }
  });

  const uniqueLeagueIds = [...new Set(memberships.map(m => m.leagueId))];

  for (const leagueId of uniqueLeagueIds) {
    const leaderboardData = await prisma.leagueMember.findMany({
      where: { leagueId: leagueId },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            totalPoints: true
          },
        },
      },
    });

    // Sort in memory by user.totalPoints desc
    const sortedLeaderboard = [...leaderboardData].sort((a, b) => b.user.totalPoints - a.user.totalPoints);

    // Format data for emission: flatten user object
    const formattedLeaderboard = sortedLeaderboard.map(lm => ({
      userId: lm.userId,
      nickname: lm.user.nickname,
      totalPoints: lm.user.totalPoints,
    }));

    socketManager.emitLeaderboard(leagueId, formattedLeaderboard);
  }

  return { message: result.message };
};

module.exports = {
  processMatchResult,
};

