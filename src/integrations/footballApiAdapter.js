// src/integrations/footballApiAdapter.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Transforms external football API data into NetScore's Prisma match schema.
 * @param {Array<Object>} externalData - Array of raw match objects from the external API.
 * @returns {Array<Object>} Array of match objects formatted for NetScore's Prisma schema.
 */
function transformMatches(externalData) {
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
        id: match.fixture.id.toString(),
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        startTime: new Date(match.fixture.date),
        status: matchStatus,
        homeScore: match.goals.home,
        awayScore: match.goals.away,
      };
    });
  } catch (error) {
    console.error("Error transforming external match data:", error);
    throw new Error("Failed to transform match data.");
  }
}

module.exports = { transformMatches };
