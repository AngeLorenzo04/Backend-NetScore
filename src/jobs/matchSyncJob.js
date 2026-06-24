// src/jobs/matchSyncJob.js
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { transformMatches } from '../integrations/footballApiAdapter.js'; // Adjust path as needed

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
  // Add more mock data as needed for testing
];

/**
 * Schedules a daily job to sync future matches from an external API.
 */
export const startMatchSyncJob = () => {
  cron.schedule('0 3 * * *', async () => {
    console.log('Running daily match synchronization job...');
    try {
      // --- Mock External API Fetch ---
      // In a real application, you would make an actual HTTP request here
      // For demonstration, we use mock data
      const externalApiRawData = mockExternalApiData; // Replace with actual API call
      console.log('Fetched raw data from external API (mocked).');

      const transformedData = transformMatches(externalApiRawData);
      console.log(`Transformed ${transformedData.length} matches.`);

      for (const match of transformedData) {
        await prisma.match.upsert({
          where: { externalId: match.externalId }, // Use externalId for upsert
          update: {
            status: match.status,
            startTime: match.startTime,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            // Only update fields that might change for existing matches
          },
          create: {
            externalId: match.externalId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            startTime: match.startTime,
            status: match.status,
            leagueId: match.leagueId,
            season: match.season,
            round: match.round,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            venue: match.venue,
          },
        });
      }
      console.log('Match synchronization job completed successfully.');
    } catch (error) {
      console.error('Error during daily match synchronization job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Etc/UTC" // Or your desired timezone
  });
  console.log('Match synchronization job scheduled to run daily at 3:00 AM UTC.');
};
