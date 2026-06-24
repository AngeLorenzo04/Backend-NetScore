const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getUserLeagues = async (req, res) => {
  const userId = req.user.userId;

  try {
    const userLeagues = await prisma.leagueMember.findMany({
      where: { userId },
      include: {
        league: {
          include: {
            leagueMembers: {
              select: {
                userId: true,
                totalPoints: true
              }
            }
          }
        }
      }
    });

    const leaguesResponse = [];
    for (const ul of userLeagues) {
      const league = ul.league;
      const sortedMembers = [...league.leagueMembers].sort((a, b) => b.totalPoints - a.totalPoints);
      const rank = sortedMembers.findIndex(m => m.userId === userId) + 1;

      leaguesResponse.push({
        id: league.id,
        name: league.name,
        code: league.inviteCode,
        membersCount: league.leagueMembers.length,
        rank: rank > 0 ? rank : 1,
        points: ul.totalPoints
      });
    }

    res.status(200).json(leaguesResponse);
  } catch (error) {
    console.error('Error fetching user leagues:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const createLeague = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.userId;

  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: 'League name must be at least 3 characters.' });
  }

  try {
    let inviteCode;
    let exists = true;
    while (exists) {
      inviteCode = 'NET-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const existing = await prisma.league.findUnique({ where: { inviteCode } });
      if (!existing) exists = false;
    }

    const newLeague = await prisma.$transaction(async (tx) => {
      const league = await tx.league.create({
        data: {
          name,
          inviteCode,
          scoringStrategy: 'CLASSIC'
        }
      });

      await tx.leagueMember.create({
        data: {
          userId,
          leagueId: league.id,
          totalPoints: 0
        }
      });

      return league;
    });

    res.status(201).json({
      id: newLeague.id,
      name: newLeague.name,
      code: newLeague.inviteCode,
      membersCount: 1,
      rank: 1,
      points: 0
    });
  } catch (error) {
    console.error('Error creating league:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const joinLeague = async (req, res) => {
  const { code } = req.body;
  const userId = req.user.userId;

  if (!code) {
    return res.status(400).json({ error: 'Invite code is required.' });
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    const league = await prisma.league.findUnique({
      where: { inviteCode: cleanCode },
      include: {
        leagueMembers: true
      }
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found.' });
    }

    const isMember = league.leagueMembers.some(m => m.userId === userId);
    if (isMember) {
      return res.status(400).json({ error: 'You are already a member of this league.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.leagueMember.create({
        data: {
          userId,
          leagueId: league.id,
          totalPoints: 0
        }
      });

      // Replicate existing predictions for scheduled matches
      const scheduledPredictions = await tx.prediction.findMany({
        where: {
          userId,
          match: { status: 'SCHEDULED' }
        },
        distinct: ['matchId']
      });

      if (scheduledPredictions.length > 0) {
        await tx.prediction.createMany({
          data: scheduledPredictions.map(p => ({
            userId,
            matchId: p.matchId,
            leagueId: league.id,
            predictedHome: p.predictedHome,
            predictedAway: p.predictedAway
          })),
          skipDuplicates: true
        });
      }
    });

    const updatedMembersCount = league.leagueMembers.length + 1;
    res.status(200).json({
      id: league.id,
      name: league.name,
      code: league.inviteCode,
      membersCount: updatedMembersCount,
      rank: updatedMembersCount,
      points: 0
    });
  } catch (error) {
    console.error('Error joining league:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getLeaderboard = async (req, res) => {
  const { leagueId } = req.params;
  const userId = req.user.userId;

  try {
    const members = await prisma.leagueMember.findMany({
      where: { leagueId },
      orderBy: { totalPoints: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true
          }
        }
      }
    });

    const leaderboard = members.map((m, index) => {
      const initials = m.user.nickname
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'US';

      return {
        id: m.user.id,
        name: m.user.nickname,
        avatar: m.user.avatarUrl || initials,
        points: m.totalPoints,
        rank: index + 1,
        trend: 'same',
        isYou: m.user.id === userId
      };
    });

    res.status(200).json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  getUserLeagues,
  createLeague,
  joinLeague,
  getLeaderboard,
};
