const request = require('supertest');
const { app } = require('../src/app'); // Import the app instance
const { PrismaClient, MatchStatus } = require('@prisma/client'); // Import PrismaClient and MatchStatus from the mocked module
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Instantiate the mocked Prisma client
const prisma = new PrismaClient();

// Mock environment variables for JWT secret and Webhook secret
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.WEBHOOK_SECRET = 'test_webhook_secret';

describe('API Integration Tests', () => {
  let authToken;
  const mockUserId = 'mock-user-id';
  const mockMatchId = 'mock-match-id';
  const mockLeagueId = 'mock-league-id';
  const mockPredictionId = 'mock-prediction-id';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset Prisma client mock functions
    prisma.user.create.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.match.findUnique.mockReset();
    prisma.match.findFirst.mockReset();
    prisma.prediction.create.mockReset();
    prisma.prediction.findUnique.mockReset();
    prisma.prediction.update.mockReset();
    prisma.prediction.upsert.mockReset();
    prisma.leagueMember.create.mockReset();
    prisma.leagueMember.findUnique.mockReset();
    prisma.leagueMember.update.mockReset();
    prisma.leagueMember.findMany.mockReset();
    prisma.league.create.mockReset();
    prisma.league.findUnique.mockReset();
    prisma.match.update.mockReset();
    prisma.$transaction.mockImplementation((callback) => callback(prisma)); // Ensure transaction works with our mock

    // Reset some test-specific variables
    authToken = '';
  });

  describe('Auth Endpoints', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        nickname: 'testuser',
        password: 'password123',
      };

      // Mock Prisma's user.create method
      prisma.user.create.mockResolvedValue({
        id: mockUserId,
        ...userData,
        passwordHash: 'hashedpassword', // bcrypt hash
      });
      // Mock Prisma's league.findUnique and leagueMember.create methods
      prisma.league.findUnique.mockResolvedValue({
        id: mockLeagueId,
        name: 'Global Fans League',
        inviteCode: 'GLOBAL26',
      });
      prisma.leagueMember.create.mockResolvedValue({
        userId: mockUserId,
        leagueId: mockLeagueId,
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toEqual(userData.email);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should log in an existing user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Mock Prisma's user.findUnique method
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: userData.email,
        nickname: 'testuser',
        passwordHash: await bcrypt.hash(userData.password, 10), // Mock hashed password
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send(userData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toEqual(userData.email);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      authToken = res.body.token; // Store token for subsequent tests
    });

    it('should return 400 for invalid login credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Mock Prisma's user.findUnique method to find user, but bcrypt will fail
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: userData.email,
        nickname: 'testuser',
        passwordHash: await bcrypt.hash('correctpassword', 10),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send(userData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Invalid credentials.');
    });
  });

  describe('Predictions Endpoints', () => {
    beforeEach(async () => {
      // Ensure a valid token exists for protected routes
      const user = { userId: mockUserId };
      authToken = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    it('should create a prediction for a scheduled match', async () => {
      const predictionData = {
        userId: mockUserId,
        matchId: mockMatchId,
        leagueId: mockLeagueId,
        predictedHome: 1,
        predictedAway: 0,
      };

      // Mock leagueMember membership check
      prisma.leagueMember.findUnique.mockResolvedValue({
        userId: mockUserId,
        leagueId: mockLeagueId,
      });

      // Mock match.findUnique for validation
      prisma.match.findUnique.mockResolvedValue({
        id: mockMatchId,
        startTime: new Date(Date.now() + 60000), // Match in the future
        status: MatchStatus.SCHEDULED,
      });
      // Mock prediction.upsert
      prisma.prediction.upsert.mockResolvedValue({
        id: mockPredictionId,
        ...predictionData,
        pointsEarned: null,
      });

      const res = await request(app)
        .post('/api/predictions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(predictionData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id', mockPredictionId);
      expect(prisma.match.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.prediction.upsert).toHaveBeenCalledTimes(1);
    });

    it('should return 400 if prediction is made for a non-scheduled match', async () => {
      const predictionData = {
        userId: mockUserId,
        matchId: mockMatchId,
        leagueId: mockLeagueId,
        predictedHome: 1,
        predictedAway: 0,
      };

      prisma.leagueMember.findUnique.mockResolvedValue({
        userId: mockUserId,
        leagueId: mockLeagueId,
      });

      prisma.match.findUnique.mockResolvedValue({
        id: mockMatchId,
        startTime: new Date(Date.now() + 60000),
        status: MatchStatus.FINISHED, // Not SCHEDULED
      });

      const res = await request(app)
        .post('/api/predictions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(predictionData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Predictions can only be made for matches that are SCHEDULED.');
      expect(prisma.match.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.prediction.upsert).not.toHaveBeenCalled();
    });

    it('should return 401 if no token is provided', async () => {
      const predictionData = {
        userId: mockUserId,
        matchId: mockMatchId,
        leagueId: mockLeagueId,
        predictedHome: 1,
        predictedAway: 0,
      };

      const res = await request(app)
        .post('/api/predictions')
        .send(predictionData);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Authentication token required.');
    });
  });

  describe('Webhooks Endpoints', () => {
    it('should process Nostradamus webhook for a finished match', async () => {
      const webhookData = {
        matchId: mockMatchId,
        homeGoals: 2,
        awayGoals: 1,
      };

      // Mock match and predictions data for the transaction
      const mockMatchWithPredictions = {
        id: mockMatchId,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        startTime: new Date(Date.now() - 3600000), // Match in the past
        status: MatchStatus.SCHEDULED,
        predictions: [
          {
            id: mockPredictionId,
            userId: mockUserId,
            matchId: mockMatchId,
            leagueId: mockLeagueId,
            predictedHome: 2,
            predictedAway: 1, // Exact score
            pointsEarned: null,
            user: { id: mockUserId, nickname: 'testuser' },
            league: { id: mockLeagueId, name: 'Test League' }
          },
          {
            id: 'another-prediction-id',
            userId: 'another-user-id',
            matchId: mockMatchId,
            leagueId: mockLeagueId,
            predictedHome: 1,
            predictedAway: 0, // Correct outcome
            pointsEarned: null,
            user: { id: 'another-user-id', nickname: 'anotheruser' },
            league: { id: mockLeagueId, name: 'Test League' }
          },
        ],
      };
      
      prisma.match.findUnique.mockResolvedValue(mockMatchWithPredictions);

      // Mock update calls within the transaction
      prisma.prediction.update.mockResolvedValue({});
      prisma.leagueMember.update.mockResolvedValue({});
      prisma.match.update.mockResolvedValue({});
      prisma.leagueMember.findMany.mockResolvedValue([
        { userId: mockUserId, user: { id: mockUserId, nickname: 'testuser' }, totalPoints: 5 },
        { userId: 'another-user-id', user: { id: 'another-user-id', nickname: 'anotheruser' }, totalPoints: 2 },
      ]);


      const crypto = require('crypto');
      const payload = JSON.stringify(webhookData);
      const signature = crypto.createHmac('sha256', 'test_webhook_secret').update(payload).digest('hex');

      const res = await request(app)
        .post('/api/webhooks/nostradamus')
        .set('X-Signature', signature)
        .send(webhookData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', `Match ${mockMatchId} results processed successfully.`);
      expect(prisma.match.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.prediction.update).toHaveBeenCalledTimes(2); // Two predictions updated
      expect(prisma.leagueMember.update).toHaveBeenCalledTimes(2); // Two league members updated
      expect(prisma.match.update).toHaveBeenCalledTimes(1); // Match updated
      expect(prisma.leagueMember.findMany).toHaveBeenCalledTimes(1); // Leaderboard fetched
    });

    it('should return 400 if match result already processed', async () => {
      const webhookData = {
        matchId: mockMatchId,
        homeGoals: 2,
        awayGoals: 1,
      };

      prisma.match.findUnique.mockResolvedValue({
        id: mockMatchId,
        status: MatchStatus.FINISHED, // Already finished
      });

      const crypto = require('crypto');
      const payload = JSON.stringify(webhookData);
      const signature = crypto.createHmac('sha256', 'test_webhook_secret').update(payload).digest('hex');

      const res = await request(app)
        .post('/api/webhooks/nostradamus')
        .set('X-Signature', signature)
        .send(webhookData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', `Match with ID ${mockMatchId} has already been processed.`);
    });
  });
});