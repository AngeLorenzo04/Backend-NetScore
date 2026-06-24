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

  // 2. Determine which leagues to apply this prediction to
  let targetLeagues = [];
  if (leagueId) {
    targetLeagues = [leagueId];
  } else {
    const userLeagues = await prisma.leagueMember.findMany({
      where: { userId },
      select: { leagueId: true }
    });
    targetLeagues = userLeagues.map(l => l.leagueId);
  }

  if (targetLeagues.length === 0) {
    throw new Error('User must be a member of at least one league to make predictions.');
  }

  // 3. Upsert predictions for all target leagues
  const upserted = [];
  for (const lid of targetLeagues) {
    const pred = await prisma.prediction.upsert({
      where: {
        userId_matchId_leagueId: {
          userId,
          matchId,
          leagueId: lid
        }
      },
      update: {
        predictedHome,
        predictedAway
      },
      create: {
        userId,
        matchId,
        leagueId: lid,
        predictedHome,
        predictedAway
      }
    });
    upserted.push(pred);
  }

  return upserted[0];
};

module.exports = {
  createPrediction,
};
