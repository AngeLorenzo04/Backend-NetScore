const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getMatches = async (req, res) => {
  const userId = req.user.userId;
  const leagueId = req.query.leagueId || null;

  try {
    // Determine target league ID
    let targetLeagueId = leagueId;
    if (!targetLeagueId) {
      const member = await prisma.leagueMember.findFirst({
        where: { userId },
        orderBy: { leagueId: 'asc' }
      });
      if (member) {
        targetLeagueId = member.leagueId;
      }
    }

    const matches = await prisma.match.findMany({
      orderBy: { startTime: 'asc' }
    });

    let predictions = [];
    if (targetLeagueId) {
      predictions = await prisma.prediction.findMany({
        where: {
          userId,
          leagueId: targetLeagueId
        }
      });
    }

    const predictionsMap = {};
    predictions.forEach(p => {
      predictionsMap[p.matchId] = p;
    });

    const response = matches.map(match => {
      const pred = predictionsMap[match.id];
      return {
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        startTime: match.startTime,
        status: match.status,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        prediction: pred ? {
          predictedHome: pred.predictedHome,
          predictedAway: pred.predictedAway,
          pointsEarned: pred.pointsEarned
        } : null
      };
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  getMatches,
};
