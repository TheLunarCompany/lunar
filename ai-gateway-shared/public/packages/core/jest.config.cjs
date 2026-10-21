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
          module: "ES2020",
          target: "ES2020",
          allowJs: true,
        },
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  testMatch: ["**/src/**/*.test.ts", "**/it/**/*.it.test.ts"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
};
