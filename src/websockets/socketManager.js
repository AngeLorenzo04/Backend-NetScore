const { Server } = require('socket.io');

let io;

const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust as needed for your frontend
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinLeague', (leagueId) => {
      socket.join(leagueId);
      console.log(`Socket ${socket.id} joined league room ${leagueId}`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

const emitLeaderboard = (leagueId, leaderboardData) => {
  if (!io) {
    console.error('Socket.io not initialized.');
    return;
  }
  io.to(leagueId).emit('leaderboardUpdate', leaderboardData);
  console.log(`Emitted leaderboard update for league ${leagueId}`);
};

module.exports = {
  init,
  emitLeaderboard,
};
