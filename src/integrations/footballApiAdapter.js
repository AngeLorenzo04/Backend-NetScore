// src/integrations/footballApiAdapter.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Transforms Football-Data.org API data into NetScore's Prisma match schema.
 * @param {Array<Object>} externalData - Array of raw match objects from Football-Data.org.
 * @returns {Array<Object>} Array of match objects formatted for NetScore's Prisma schema.
 */
function transformMatches(externalData) {
  try {
    return externalData.map(match => {
      const homeTeamName = (match.homeTeam && (match.homeTeam.name || match.homeTeam.shortName)) || 'TBD';
      const awayTeamName = (match.awayTeam && (match.awayTeam.name || match.awayTeam.shortName)) || 'TBD';
      const status = match.status; // e.g., "TIMED", "SCHEDULED", "IN_PLAY", "FINISHED"

      let matchStatus;
      switch (status) {
        case 'TIMED':
        case 'SCHEDULED':
          matchStatus = 'SCHEDULED';
          break;
        case 'IN_PLAY':
        case 'PAUSED':
          matchStatus = 'IN_PLAY';
          break;
        case 'FINISHED':
          matchStatus = 'FINISHED';
          break;
        default:
          matchStatus = 'SCHEDULED';
      }

      let startTime = new Date(match.utcDate);
      try {
        const formatter = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Europe/Rome',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const romeDateString = formatter.format(startTime).replace(' ', 'T') + 'Z';
        startTime = new Date(new Date(romeDateString).getTime() - 2 * 60 * 60 * 1000);
      } catch (e) {
        console.warn("Failed to shift time to Europe/Rome, using default UTC date:", e);
        startTime = new Date(startTime.getTime() - 2 * 60 * 60 * 1000);
      }

      return {
        id: match.id.toString(),
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        startTime: startTime,
        status: matchStatus,
        homeScore: match.score && match.score.fullTime ? match.score.fullTime.home : null,
        awayScore: match.score && match.score.fullTime ? match.score.fullTime.away : null,
      };
    });
  } catch (error) {
    console.error("Error transforming Football-Data.org match data:", error);
    throw new Error("Failed to transform match data.");
  }
}

module.exports = { transformMatches };
