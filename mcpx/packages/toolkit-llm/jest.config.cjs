/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts|js)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ES2022",
          target: "ES2022",
          allowJs: true,
        },
      },
    ],
  },
  // @google/genai and its deps are ESM-only, need transformation
  transformIgnorePatterns: [
    "node_modules/(?!(@google/genai|p-retry|is-network-error)/)",
  ],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@mcpx/toolkit-core/(.*)$": "<rootDir>/../toolkit-core/src/$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  testMatch: ["**/src/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
};
