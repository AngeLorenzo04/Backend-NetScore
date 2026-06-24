const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// GET /api/matches - Protected route
router.get('/', authenticateToken, matchController.getMatches);

module.exports = router;
