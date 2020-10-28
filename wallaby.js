module.exports = () => ({
  autoDetect: true,
  trace: true,
  files: [
    "src/**/*.ts",
    { pattern: "**/src/**/*.test.ts", ignore: true },
  ],
  tests: ["src/**/*.test.ts"],
});
