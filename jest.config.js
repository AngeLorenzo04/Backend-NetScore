/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^@prisma/client$': '<rootDir>/tests/__mocks__/@prisma/client.js',
  },
};

module.exports = config;
