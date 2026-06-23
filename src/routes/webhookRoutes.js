const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// POST /api/webhooks/nostradamus
router.post('/', webhookController.handleNostradamusWebhook);

module.exports = router;
