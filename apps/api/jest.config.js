/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { diagnostics: false }],
  },
  // Load .env and set DATABASE_URL before any test file runs
  globalSetup: "./src/__tests__/globalSetup.ts",
  // Make test helpers available
  moduleDirectories: ["node_modules", "src"],
  // Only match files inside __tests__ directories
  testMatch: ["**/__tests__/**/*.test.ts"],
  // Longer timeout for integration tests hitting real DB
  testTimeout: 15000,
  // Mock modules that use ESM or can't run in test env
  moduleNameMapper: {
    "^puppeteer-core$": "<rootDir>/src/__tests__/helpers/__mocks__/puppeteer-core.ts",
    "^@anthropic-ai/sdk$": "<rootDir>/src/__tests__/helpers/__mocks__/anthropic.ts",
    "^stripe$": "<rootDir>/src/__tests__/helpers/__mocks__/stripe.ts",
    "^sharp$": "<rootDir>/src/__tests__/helpers/__mocks__/sharp.ts",
    "^pdfkit$": "<rootDir>/src/__tests__/helpers/__mocks__/pdfkit.ts",
  },
};
