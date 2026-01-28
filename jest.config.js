export default {
  testEnvironment: "node",
  transform: {},
  haste: {
    throwOnModuleCollision: false,
  },
  testMatch: ["**/__tests__/**/*.test.js", "**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "services/**/*.js",
    "shared/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  testTimeout: 10000,
};
