const express = require('express');
const http = require('http');
const cors = require('cors');
const predictionRoutes = require('./routes/predictionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const socketManager = require('./websockets/socketManager');
const { startMatchSyncJob } = require('./jobs/matchSyncJob'); // Import job
const { webhookAuth } = require('./middlewares/webhookAuth'); // Import webhookAuth middleware

const app = express();
const server = http.createServer(app);

// Initialize Socket.io through the manager
socketManager.init(server);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/predictions', predictionRoutes);
// Apply webhookAuth middleware to the webhook route
app.use('/api/webhooks/nostradamus', webhookAuth, webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start scheduled jobs
startMatchSyncJob();

module.exports = { app, server };
