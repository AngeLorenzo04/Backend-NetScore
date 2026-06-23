// tests/__mocks__/@prisma/client.js
const { PrismaClient: RealPrismaClient } = jest.requireActual('@prisma/client');

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
  },
  leagueMember: {
    update: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

// This allows us to mock the PrismaClient constructor itself
// So that `new PrismaClient()` in our code returns our mock
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  // Export enums or other types if needed by the tests
  MatchStatus: RealPrismaClient.MatchStatus, // Or define your own mock enum
}));

module.exports = {
  PrismaClient: jest.fn(() => mockPrisma),
  mockPrisma,
};
