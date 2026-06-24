const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const scoringService = require('../services/scoringService');

const handleNostradamusWebhook = async (req, res) => {
  const { matchId, homeGoals, awayGoals } = req.body;

  if (!matchId || homeGoals === undefined || awayGoals === undefined) {
    return res.status(400).json({ error: 'Missing required fields: matchId, homeGoals, awayGoals' });
  }

  try {
    // Idempotency Shield: Check if the match result has already been processed
    const existingMatch = await prisma.match.findUnique({
      where: { id: parseInt(matchId, 10) }, // Assuming matchId is an integer
      select: { status: true },
    });

    if (existingMatch && existingMatch.status === 'FINISHED') {
      console.log(`Webhook for matchId ${matchId} already processed (status: FINISHED). Skipping.`);
      return res.status(200).json({ message: `Webhook for matchId ${matchId} already processed.` });
    }

    const result = await scoringService.processMatchResult(matchId, homeGoals, awayGoals);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error processing Nostradamus webhook:', error.message);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  handleNostradamusWebhook,
};
