const { PrismaClient } = require('@prisma/client');
const ClassicScoring = require('../strategies/classicScoring');

const prisma = new PrismaClient();
const classicScoring = new ClassicScoring();

const processMatchResult = async (matchId, homeGoals, awayGoals) => {
  if (homeGoals === undefined || awayGoals === undefined) {
    throw new Error('Actual homeGoals and awayGoals must be provided.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Match and all its Predictions
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: {
        predictions: {
          include: {
            user: true, // Needed for LeagueMember update (although not directly used here, good for completeness)
            league: true, // Needed for LeagueMember update and potential strategy mapping
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
    if (match.status === 'IN_PLAY') {
      // Handle cases where IN_PLAY might be allowed, or throw if not. For now, let's allow IN_PLAY to FINISHED.
    }


    const updates = [];
    const leagueMemberPointChanges = new Map(); // Map to store total points per league member

    for (const prediction of match.predictions) {
      // Determine scoring strategy (for now, always classicScoring)
      // Later: const strategy = getScoringStrategy(prediction.league.scoringStrategy);
      const pointsEarned = classicScoring.calculatePoints(
        prediction.predictedHome,
        prediction.predictedAway,
        homeGoals,
        awayGoals
      );

      // Add prediction update to transaction
      updates.push(
        tx.prediction.update({
          where: { id: prediction.id },
          data: { pointsEarned: pointsEarned },
        })
      );

      // Aggregate points for LeagueMembers
      const leagueMemberKey = `${prediction.userId}-${prediction.leagueId}`;
      leagueMemberPointChanges.set(
        leagueMemberKey,
        (leagueMemberPointChanges.get(leagueMemberKey) || 0) + pointsEarned
      );
    }

    // Update LeagueMembers totalPoints
    for (const [key, points] of leagueMemberPointChanges.entries()) {
      const [userId, leagueId] = key.split('-');
      updates.push(
        tx.leagueMember.update({
          where: {
            userId_leagueId: {
              userId: userId,
              leagueId: leagueId,
            },
          },
          data: {
            totalPoints: {
              increment: points,
            },
          },
        })
      );
    }

    // Update Match status and scores
    updates.push(
      tx.match.update({
        where: { id: matchId },
        data: {
          status: 'FINISHED',
          homeGoals: homeGoals,
          awayGoals: awayGoals,
        },
      })
    );

    await Promise.all(updates); // Execute all updates concurrently within the transaction

    return { message: `Match ${matchId} results processed successfully.` };
  });
};

module.exports = {
  processMatchResult,
};
