// src/jobs/matchSyncJob.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { transformMatches } = require('../integrations/footballApiAdapter'); // Adjust path as needed
const { processMatchResult } = require('../services/scoringService');

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
      try {
        const existingMatch = await prisma.match.findUnique({
          where: { id: match.id }
        });

        if (match.status === 'FINISHED') {
          if (!existingMatch || existingMatch.status !== 'FINISHED') {
            console.log(`Match ${match.id} (${match.homeTeam} vs ${match.awayTeam}) finished. Processing results...`);
            
            // First upsert the match record as SCHEDULED (or keep its existing status) so processMatchResult can process predictions
            await prisma.match.upsert({
              where: { id: match.id },
              update: {
                startTime: match.startTime,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                status: existingMatch ? existingMatch.status : 'SCHEDULED',
              },
              create: {
                id: match.id,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                startTime: match.startTime,
                status: 'SCHEDULED',
              },
            });

            // Calculate points, update predictions/leaderboard, and mark it FINISHED
            await processMatchResult(match.id, match.homeScore, match.awayScore);
          } else {
            // Already finished and processed, just update any metadata/scores if needed
            await prisma.match.update({
              where: { id: match.id },
              data: {
                startTime: match.startTime,
                homeGoals: match.homeScore,
                awayGoals: match.awayScore,
              }
            });
          }
        } else {
          // SCHEDULED or IN_PLAY
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
      } catch (err) {
        console.error(`Error processing match ${match.id} synchronization:`, err);
      }
    }
    console.log('Match synchronization completed successfully.');
  } catch (error) {
    console.error('Error during match synchronization:', error);
  }
};

let syncTimeout = null;

const scheduleNextSync = async () => {
  try {
    console.log('Calculating next dynamic match sync...');
    const now = new Date();

    // Find the closest unfinished match
    const nextMatch = await prisma.match.findFirst({
      where: {
        status: { not: 'FINISHED' }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    if (!nextMatch) {
      console.log('No unfinished matches found. Dynamic sync scheduling paused.');
      return;
    }

    const matchStartTime = new Date(nextMatch.startTime);
    const syncTime = new Date(matchStartTime.getTime() + 115 * 60 * 1000);
    let delayMs = syncTime.getTime() - now.getTime();

    console.log(`Closest unfinished match: ${nextMatch.homeTeam} vs ${nextMatch.awayTeam} (Start: ${matchStartTime.toISOString()})`);
    console.log(`Target sync time: ${syncTime.toISOString()}`);

    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    if (delayMs <= 0) {
      console.log('Target sync time has already passed. Executing sync now...');
      await syncMatches();
      // To avoid infinite loops in case the external API hasn't marked it finished yet,
      // we schedule the next check in 5 minutes.
      console.log('Waiting 5 minutes before next scheduling check...');
      syncTimeout = setTimeout(scheduleNextSync, 5 * 60 * 1000);
    } else {
      console.log(`Scheduling sync in ${Math.round(delayMs / 1000 / 60)} minutes (${delayMs} ms).`);
      syncTimeout = setTimeout(async () => {
        console.log(`Scheduled sync running now for match: ${nextMatch.homeTeam} vs ${nextMatch.awayTeam}`);
        await syncMatches();
        scheduleNextSync();
      }, delayMs);
    }
  } catch (error) {
    console.error('Error scheduling next sync:', error);
    // Retry in 1 minute
    syncTimeout = setTimeout(scheduleNextSync, 60000);
  }
};

const startMatchSyncJob = () => {
  // Start the dynamic scheduling
  scheduleNextSync();

  // Daily backup job
  cron.schedule('0 3 * * *', async () => {
    console.log('Running daily backup match synchronization job...');
    await syncMatches();
    // Re-trigger dynamic schedule check in case of missed states
    scheduleNextSync();
  }, {
    scheduled: true,
    timezone: "Etc/UTC"
  });
  console.log('Match synchronization job initialized (dynamic + daily backup at 3:00 AM UTC).');
};

module.exports = {
  startMatchSyncJob,
  syncMatches
};
