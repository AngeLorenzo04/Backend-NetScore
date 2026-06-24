// src/jobs/matchSyncJob.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { transformMatches } = require('../integrations/footballApiAdapter'); // Adjust path as needed

const prisma = new PrismaClient();

const mockExternalApiData = [
  {
    id: 202601,
    utcDate: "2026-06-25T18:00:00Z",
    status: 'TIMED',
    homeTeam: { name: 'Italy' },
    awayTeam: { name: 'Germany' },
    score: { fullTime: { home: null, away: null } }
  },
  {
    id: 202602,
    utcDate: "2026-06-26T21:00:00Z",
    status: 'TIMED',
    homeTeam: { name: 'Argentina' },
    awayTeam: { name: 'Brazil' },
    score: { fullTime: { home: null, away: null } }
  },
  {
    id: 202603,
    utcDate: "2026-06-27T15:00:00Z",
    status: 'TIMED',
    homeTeam: { name: 'France' },
    awayTeam: { name: 'Spain' },
    score: { fullTime: { home: null, away: null } }
  },
];

const syncMatches = async () => {
  console.log('Running match synchronization (Football-Data.org)...');
  try {
    const apiKey = process.env.FOOTBALL_API_KEY;
    const competition = process.env.FOOTBALL_API_COMPETITION || 'PL'; // e.g. 'PL', 'SA', 'WC', 'CL'
    const season = process.env.FOOTBALL_API_SEASON || '2025';

    let externalApiRawData = [];

    if (apiKey) {
      const url = `https://api.football-data.org/v4/competitions/${competition}/matches?season=${season}`;
      console.log(`Fetching fixtures from Football-Data.org: ${url}`);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Auth-Token': apiKey,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`API Response data keys: ${Object.keys(data)}`);
          if (data.matches) {
            console.log(`API returned ${data.matches.length} matches.`);
          }
          externalApiRawData = data.matches || [];
        } else {
          const text = await response.text();
          console.warn(`External API responded with status ${response.status}: ${text}`);
        }
      } catch (err) {
        console.error('Failed to fetch from Football-Data.org API:', err);
      }
    }

    if (!externalApiRawData || externalApiRawData.length === 0) {
      console.log('No matches fetched from API. Falling back to mock Football-Data.org matches.');
      externalApiRawData = mockExternalApiData;
    } else {
      console.log(`Successfully fetched ${externalApiRawData.length} matches from external API.`);
    }

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
