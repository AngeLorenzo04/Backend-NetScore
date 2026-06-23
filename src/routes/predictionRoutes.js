const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Import authMiddleware

// POST /api/predictions - Protected route
router.post('/', authenticateToken, predictionController.createPrediction);

module.exports = router;
