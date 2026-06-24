const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// GET /api/users/profile - Protected route
router.get('/profile', authenticateToken, userController.getProfile);

// PUT /api/users/profile - Protected route
router.put('/profile', authenticateToken, userController.updateProfile);

module.exports = router;
