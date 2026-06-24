const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { nickname, email, password, avatarUrl } = req.body;

  try {
    const updateData = {};

    if (nickname !== undefined) updateData.nickname = nickname;
    if (email !== undefined) updateData.email = email;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No update data provided.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser.id,
        nickname: updatedUser.nickname,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email or nickname already in use.' });
    }
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getProfile = async (req, res) => {
  const userId = req.user.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userLeagues = await prisma.leagueMember.findMany({
      where: { userId },
      include: {
        league: {
          include: {
            leagueMembers: {
              select: {
                userId: true,
                totalPoints: true,
              },
            },
          },
        },
      },
    });

    const leaguesResponse = [];
    let totalPoints = 0;

    for (const ul of userLeagues) {
      const league = ul.league;
      const sortedMembers = [...league.leagueMembers].sort((a, b) => b.totalPoints - a.totalPoints);
      const rank = sortedMembers.findIndex(m => m.userId === userId) + 1;

      leaguesResponse.push({
        id: league.id,
        name: league.name,
        code: league.inviteCode,
        memberCount: league.leagueMembers.length,
        rank: rank > 0 ? rank : 1,
        points: ul.totalPoints,
        creatorId: league.creatorId,
      });

      if (league.inviteCode === 'GLOBAL26') {
        totalPoints = ul.totalPoints;
      }
    }

    res.status(200).json({
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      avatarUrl: user.avatarUrl,
      totalPoints,
      leagues: leaguesResponse,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const getOtherUserProfile = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userLeagues = await prisma.leagueMember.findMany({
      where: { userId },
      include: {
        league: {
          include: {
            leagueMembers: {
              select: {
                userId: true,
                totalPoints: true,
              },
            },
          },
        },
      },
    });

    const leaguesResponse = [];
    let totalPoints = 0;

    for (const ul of userLeagues) {
      const league = ul.league;
      const sortedMembers = [...league.leagueMembers].sort((a, b) => b.totalPoints - a.totalPoints);
      const rank = sortedMembers.findIndex(m => m.userId === userId) + 1;

      leaguesResponse.push({
        id: league.id,
        name: league.name,
        memberCount: league.leagueMembers.length,
        rank: rank > 0 ? rank : 1,
        points: ul.totalPoints,
        creatorId: league.creatorId,
      });

      if (league.inviteCode === 'GLOBAL26') {
        totalPoints = ul.totalPoints;
      }
    }

    res.status(200).json({
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      totalPoints,
      leagues: leaguesResponse,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  updateProfile,
  getProfile,
  getOtherUserProfile,
};
