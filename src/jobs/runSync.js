// src/jobs/runSync.js
const { syncMatches } = require('./matchSyncJob');

syncMatches()
  .then(() => {
    console.log('Manual sync process finished.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Manual sync process failed:', err);
    process.exit(1);
  });
