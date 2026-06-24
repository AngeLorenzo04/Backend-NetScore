const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// PUT /api/users/profile - Protected route
router.put('/profile', authenticateToken, userController.updateProfile);

module.exports = router;
