const express = require('express');
const http = require('http');
const cors = require('cors');
const predictionRoutes = require('./routes/predictionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const matchRoutes = require('./routes/matchRoutes');
const leagueRoutes = require('./routes/leagueRoutes');
const socketManager = require('./websockets/socketManager');
const { startMatchSyncJob } = require('./jobs/matchSyncJob'); // Import job
const { webhookAuth } = require('./middlewares/webhookAuth'); // Import webhookAuth middleware

const app = express();
const server = http.createServer(app);

// Initialize Socket.io through the manager
socketManager.init(server);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Prevent caching for API responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Routes
app.use('/api/predictions', predictionRoutes);
// Apply webhookAuth middleware to the webhook route
app.use('/api/webhooks/nostradamus', webhookAuth, webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/leagues', leagueRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start scheduled jobs
startMatchSyncJob();

module.exports = { app, server };
