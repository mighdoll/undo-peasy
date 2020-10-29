module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  setupFilesAfterEnv: ["./jestConsole.ts"],
  testMatch: ["**/src/**/*.test.ts"],
  collectCoverageFrom: [
    "**/*.ts",
    "!**/node_modules/**",
    '!tmp/**'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tmp/',
  ]
};
