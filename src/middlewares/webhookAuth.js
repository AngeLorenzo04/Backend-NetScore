// src/middlewares/webhookAuth.js
const crypto = require('crypto');

/**
 * Middleware to verify HMAC SHA256 signature for incoming webhooks.
 * Expects an 'X-Signature' header with the HMAC signature.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const webhookAuth = (req, res, next) => {
  const signature = req.get('X-Signature');
  const secret = process.env.WEBHOOK_SECRET; // Ensure this is set in your environment variables

  if (!secret) {
    console.error('WEBHOOK_SECRET is not defined in environment variables.');
    return res.status(500).send('Webhook secret not configured.');
  }

  if (!signature) {
    console.warn('Webhook received without X-Signature header.');
    return res.status(401).send('Unauthorized: X-Signature header missing.');
  }

  // Ensure req.body is available for signing.
  const payload = JSON.stringify(req.body);

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');

  if (digest !== signature) {
    console.warn('Webhook signature mismatch. Expected:', digest, 'Received:', signature);
    return res.status(401).send('Unauthorized: Invalid signature.');
  }

  console.log('Webhook signature verified successfully.');
  next();
};

module.exports = { webhookAuth };
