const { app, server, io } = require('./src/app');

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  // Example: Listen for a custom event
  socket.on('chatMessage', (msg) => {
    console.log('message: ' + msg);
    io.emit('chatMessage', msg); // Broadcast to all connected clients
  });
});

