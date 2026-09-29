/** @type {import('jest').Config} */
module.exports = {
  // Explicitly exclude e2e folder from Jest
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/dist/'],
  // Only match test files, not spec files (Playwright uses .spec.ts)
  testMatch: ['**/src/**/*.test.{ts,tsx}', '**/src/**/*.spec.{ts,tsx}'],
  // If no test files are found, don't fail
  passWithNoTests: true,
};

