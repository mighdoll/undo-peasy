module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  setupFilesAfterEnv: ["./jestConsole.ts"],
  testMatch: ["**/src/**/*.test.ts"],
};