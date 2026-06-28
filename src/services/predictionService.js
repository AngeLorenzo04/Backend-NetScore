const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createPrediction = async ({ userId, matchId, leagueId, predictedHome, predictedAway }) => {
  // 1. Validate match existence and status
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error('Match not found.');
  }

  if (match.status !== 'SCHEDULED') {
    throw new Error('Predictions can only be made for matches that are SCHEDULED.');
  }

  if ((match.homeTeam && match.homeTeam.toUpperCase() === 'TBD') || 
      (match.awayTeam && match.awayTeam.toUpperCase() === 'TBD')) {
    throw new Error('Predictions cannot be made for matches with undetermined teams (TBD).');
  }

  if (new Date() >= match.startTime) {
    throw new Error('Predictions cannot be made after the match has started.');
  }

  // 2. Verify user has at least one league membership to allow predictions
  const membershipCount = await prisma.leagueMember.count({
    where: { userId }
  });

  if (membershipCount === 0) {
    throw new Error('User must be a member of at least one league to make predictions.');
  }

  // 3. Upsert prediction (global per user per match)
  const pred = await prisma.prediction.upsert({
    where: {
      userId_matchId: {
        userId,
        matchId
      }
    },
    update: {
      predictedHome,
      predictedAway
    },
    create: {
      userId,
      matchId,
      predictedHome,
      predictedAway
    }
  });

  return pred;
};

module.exports = {
  createPrediction,
};
