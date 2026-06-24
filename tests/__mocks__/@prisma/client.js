// tests/__mocks__/@prisma/client.js

const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  match: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  prediction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  leagueMember: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  league: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

const mockMatchStatus = {
  SCHEDULED: 'SCHEDULED',
  IN_PLAY: 'IN_PLAY',
  FINISHED: 'FINISHED',
};

// This allows us to mock the PrismaClient constructor itself
// So that `new PrismaClient()` in our code returns our mock
const PrismaClient = jest.fn(() => mockPrisma);

// Export enums or other types if needed by the tests
module.exports = {
  PrismaClient,
  MatchStatus: mockMatchStatus,
};