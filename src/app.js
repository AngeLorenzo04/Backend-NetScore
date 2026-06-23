const express = require('express');
const http = require('http');
const cors = require('cors');
const predictionRoutes = require('./routes/predictionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const socketManager = require('./websockets/socketManager'); // Import socketManager

const app = express();
const server = http.createServer(app);

// Initialize Socket.io through the manager
socketManager.init(server);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/predictions', predictionRoutes);
app.use('/api/webhooks/nostradamus', webhookRoutes);

// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = { app, server }; // io is now managed internally by socketManager
