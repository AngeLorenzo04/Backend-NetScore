const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const predictionRoutes = require('./routes/predictionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Adjust as needed for your frontend
    methods: ['GET', 'POST'],
  },
});

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

module.exports = { app, server, io };
