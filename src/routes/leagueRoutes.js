const express = require('express');
const router = express.Router();
const leagueController = require('../controllers/leagueController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// GET /api/leagues - Fetch all leagues user is in
router.get('/', authenticateToken, leagueController.getUserLeagues);

// POST /api/leagues - Create a new league
router.post('/', authenticateToken, leagueController.createLeague);

// POST /api/leagues/join - Join an existing league by invite code
router.post('/join', authenticateToken, leagueController.joinLeague);

// GET /api/leagues/:leagueId/leaderboard - Get leaderboard of a league
router.get('/:leagueId/leaderboard', authenticateToken, leagueController.getLeaderboard);

module.exports = router;
