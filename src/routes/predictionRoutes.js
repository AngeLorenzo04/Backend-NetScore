const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');

// POST /api/predictions
router.post('/', predictionController.createPrediction);

module.exports = router;
