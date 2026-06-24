// src/jobs/matchSyncJob.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { transformMatches } = require('../integrations/footballApiAdapter'); // Adjust path as needed

const prisma = new PrismaClient();

const mockExternalApiData = [
  {
    fixture: {
      id: 12345,
      date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      status: { short: 'NS' },
      venue: { name: 'Mock Stadium 1' }
    },
    league: { id: 1, season: 2026, round: 'Regular Season - 1' },
    teams: { home: { name: 'Mock Home Team A' }, away: { name: 'Mock Away Team B' } },
    goals: { home: null, away: null }
  },
  {
    fixture: {
      id: 12346,
      date: new Date(Date.now() + 2 * 86400000).toISOString(), // Day after tomorrow
      status: { short: 'NS' },
      venue: { name: 'Mock Stadium 2' }
    },
    league: { id: 1, season: 2026, round: 'Regular Season - 1' },
    teams: { home: { name: 'Mock Home Team C' }, away: { name: 'Mock Away Team D' } },
    goals: { home: null, away: null }
  },
];

const syncMatches = async () => {
  console.log('Running match synchronization...');
  try {
    const externalApiRawData = mockExternalApiData;
    console.log('Fetched raw data from external API (mocked).');

    const transformedData = transformMatches(externalApiRawData);
    console.log(`Transformed ${transformedData.length} matches.`);

    for (const match of transformedData) {
      await prisma.match.upsert({
        where: { id: match.id },
        update: {
          status: match.status,
          startTime: match.startTime,
          homeGoals: match.homeScore,
          awayGoals: match.awayScore,
        },
        create: {
          id: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          startTime: match.startTime,
          status: match.status,
          homeGoals: match.homeScore,
          awayGoals: match.awayScore,
        },
      });
    }
    console.log('Match synchronization completed successfully.');
  } catch (error) {
    console.error('Error during match synchronization:', error);
  }
};

const startMatchSyncJob = () => {
  cron.schedule('0 3 * * *', async () => {
    console.log('Running daily match synchronization job...');
    await syncMatches();
  }, {
    scheduled: true,
    timezone: "Etc/UTC"
  });
  console.log('Match synchronization job scheduled to run daily at 3:00 AM UTC.');
};

module.exports = {
  startMatchSyncJob,
  syncMatches
};
