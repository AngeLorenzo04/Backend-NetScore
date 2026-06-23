const scoringService = require('../services/scoringService');

const handleNostradamusWebhook = async (req, res) => {
  const { matchId, homeGoals, awayGoals } = req.body;

  if (!matchId || homeGoals === undefined || awayGoals === undefined) {
    return res.status(400).json({ error: 'Missing required fields: matchId, homeGoals, awayGoals' });
  }

  try {
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
