const predictionService = require('../services/predictionService');

const createPrediction = async (req, res) => {
  const { matchId, predictedHome, predictedAway } = req.body;
  const userId = req.user.userId;

  if (!userId || !matchId || predictedHome === undefined || predictedAway === undefined) {
    return res.status(400).json({ error: 'Missing required prediction fields.' });
  }

  try {
    const newPrediction = await predictionService.createPrediction({
      userId,
      matchId,
      predictedHome,
      predictedAway,
    });
    res.status(201).json(newPrediction);
  } catch (error) {
    console.error('Error creating prediction:', error);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createPrediction,
};
