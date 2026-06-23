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

  if (new Date() >= match.startTime) {
    throw new Error('Predictions cannot be made after the match has started.');
  }

  // 2. Check if a prediction already exists for this user, match, and league
  const existingPrediction = await prisma.prediction.findUnique({
    where: {
      userId_matchId_leagueId: {
        userId,
        matchId,
        leagueId,
      },
    },
  });

  if (existingPrediction) {
    throw new Error('You have already made a prediction for this match in this league.');
  }

  // 3. Create the prediction
  return await prisma.prediction.create({
    data: {
      userId,
      matchId,
      leagueId,
      predictedHome,
      predictedAway,
    },
  });
};

module.exports = {
  createPrediction,
};
