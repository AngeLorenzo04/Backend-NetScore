// src/integrations/footballApiAdapter.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Transforms external football API data into NetScore's Prisma match schema.
 * @param {Array<Object>} externalData - Array of raw match objects from the external API.
 * @returns {Array<Object>} Array of match objects formatted for NetScore's Prisma schema.
 */
export function transformMatches(externalData) {
  try {
    return externalData.map(match => {
      // Example mapping, adjust based on actual external API and Prisma schema
      const homeTeamName = match.teams.home.name;
      const awayTeamName = match.teams.away.name;
      const status = match.fixture.status.short; // e.g., 'NS', 'FT', 'HT', 'PST'

      let matchStatus;
      switch (status) {
        case 'NS':
          matchStatus = 'SCHEDULED';
          break;
        case 'FT':
        case 'AET':
        case 'PEN':
          matchStatus = 'FINISHED';
          break;
        case 'HT':
        case '1H':
        case '2H':
          matchStatus = 'LIVE';
          break;
        case 'PST':
        case 'CANC':
        case 'ABD':
          matchStatus = 'CANCELLED';
          break;
        case 'WO': // Walkover
          matchStatus = 'FINISHED';
          break;
        default:
          matchStatus = 'UNKNOWN';
      }

      return {
        id: match.fixture.id, // External ID as unique identifier
        externalId: match.fixture.id.toString(),
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        startTime: new Date(match.fixture.date),
        status: matchStatus,
        leagueId: match.league.id,
        season: match.league.season,
        round: match.league.round,
        // Assuming scores are available, otherwise set to null or default
        homeScore: match.goals.home,
        awayScore: match.goals.away,
        venue: match.fixture.venue.name,
      };
    });
  } catch (error) {
    console.error("Error transforming external match data:", error);
    throw new Error("Failed to transform match data.");
  }
}
