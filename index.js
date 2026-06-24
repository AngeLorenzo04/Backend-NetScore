const { app, server } = require('./src/app');

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Server listens, socket.io is initialized inside src/app.js via socketManager

