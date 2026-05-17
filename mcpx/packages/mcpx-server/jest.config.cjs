/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ES2022",
          target: "ES2022",
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@mcpx/toolkit-core/(.*)$": "<rootDir>/../toolkit-core/src/$1",
    "^@mcpx/webapp-protocol/(.*)$": "<rootDir>/../webapp-protocol/src/$1",
    "^@mcpx/shared-model$": "<rootDir>/../shared-model/src/index",
    "^@mcpx/shared-model/(.*)$": "<rootDir>/../shared-model/src/$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  testMatch: ["**/src/**/*.test.ts", "**/it/**/*.it.test.ts"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
};
