const request = require('supertest');
const { app } = require('../../src/app'); // Import the app instance
const { mockPrisma } = require('../__mocks__/@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock environment variables for JWT secret
process.env.JWT_SECRET = 'test_jwt_secret';

describe('API Integration Tests', () => {
  let authToken;
  const mockUserId = 'mock-user-id';
  const mockMatchId = 'mock-match-id';
  const mockLeagueId = 'mock-league-id';
  const mockPredictionId = 'mock-prediction-id';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset some mock data
    authToken = '';
    mockPrisma.user.create.mockReset();
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.match.findUnique.mockReset();
    mockPrisma.prediction.create.mockReset();
    mockPrisma.prediction.findUnique.mockReset();
    mockPrisma.leagueMember.update.mockReset();
    mockPrisma.match.update.mockReset();
  });

  describe('Auth Endpoints', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        nickname: 'testuser',
        password: 'password123',
      };

      // Mock Prisma's user.create method
      mockPrisma.user.create.mockResolvedValue({
        id: mockUserId,
        ...userData,
        passwordHash: 'hashedpassword', // bcrypt hash
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toEqual(userData.email);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should log in an existing user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Mock Prisma's user.findUnique method
      mockPrisma.user.findUnique.mockResolvedValue({
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
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);

      authToken = res.body.token; // Store token for subsequent tests
    });

    it('should return 400 for invalid login credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Mock Prisma's user.findUnique method to find user, but bcrypt will fail
      mockPrisma.user.findUnique.mockResolvedValue({
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

      // Mock match.findUnique for validation
      mockPrisma.match.findUnique.mockResolvedValue({
        id: mockMatchId,
        startTime: new Date(Date.now() + 60000), // Match in the future
        status: 'SCHEDULED',
      });
      // Mock prediction.findUnique to ensure no existing prediction
      mockPrisma.prediction.findUnique.mockResolvedValue(null);
      // Mock prediction.create
      mockPrisma.prediction.create.mockResolvedValue({
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
      expect(mockPrisma.match.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.prediction.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.prediction.create).toHaveBeenCalledTimes(1);
    });

    it('should return 400 if prediction is made for a non-scheduled match', async () => {
      const predictionData = {
        userId: mockUserId,
        matchId: mockMatchId,
        leagueId: mockLeagueId,
        predictedHome: 1,
        predictedAway: 0,
      };

      mockPrisma.match.findUnique.mockResolvedValue({
        id: mockMatchId,
        startTime: new Date(Date.now() + 60000),
        status: 'FINISHED', // Not SCHEDULED
      });
      mockPrisma.prediction.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/predictions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(predictionData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Predictions can only be made for matches that are SCHEDULED.');
      expect(mockPrisma.match.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.prediction.create).not.toHaveBeenCalled();
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

      // Mock transaction for score processing
      mockPrisma.match.findUnique.mockResolvedValue({
        id: mockMatchId,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        startTime: new Date(Date.now() - 3600000), // Match in the past
        status: 'SCHEDULED',
        predictions: [
          {
            id: mockPredictionId,
            userId: mockUserId,
            matchId: mockMatchId,
            leagueId: mockLeagueId,
            predictedHome: 2,
            predictedAway: 1, // Exact score
            pointsEarned: null,
          },
          {
            id: 'another-prediction-id',
            userId: 'another-user-id',
            matchId: mockMatchId,
            leagueId: mockLeagueId,
            predictedHome: 1,
            predictedAway: 0, // Correct outcome
            pointsEarned: null,
          },
        ],
      });

      // Mock update calls within the transaction
      mockPrisma.prediction.update.mockResolvedValue({});
      mockPrisma.leagueMember.update.mockResolvedValue({});
      mockPrisma.match.update.mockResolvedValue({});
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { userId: mockUserId, user: { nickname: 'testuser' }, totalPoints: 5 },
        { userId: 'another-user-id', user: { nickname: 'anotheruser' }, totalPoints: 2 },
      ]);


      const res = await request(app)
        .post('/api/webhooks/nostradamus')
        .send(webhookData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', `Match ${mockMatchId} results processed successfully.`);
      expect(mockPrisma.match.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.prediction.update).toHaveBeenCalledTimes(2); // Two predictions updated
      expect(mockPrisma.leagueMember.update).toHaveBeenCalledTimes(2); // Two league members updated
      expect(mockPrisma.match.update).toHaveBeenCalledTimes(1); // Match updated
      expect(mockPrisma.leagueMember.findMany).toHaveBeenCalledTimes(1); // Leaderboard fetched
    });

    it('should return 400 if match result already processed', async () => {
      const webhookData = {
        matchId: mockMatchId,
        homeGoals: 2,
        awayGoals: 1,
      };

      mockPrisma.match.findUnique.mockResolvedValue({
        id: mockMatchId,
        status: 'FINISHED', // Already finished
      });

      const res = await request(app)
        .post('/api/webhooks/nostradamus')
        .send(webhookData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', `Match with ID ${mockMatchId} has already been processed.`);
    });
  });
});
