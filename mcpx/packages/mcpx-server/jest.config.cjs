/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm", // single line does 90 % of the work
  testEnvironment: "node",

  // Tell ts-jest to emit pure ESM so Node can `import`
  globals: { "ts-jest": { useESM: true } },

  // 🗺  Drop the .js extension ONLY for relative imports
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },

  extensionsToTreatAsEsm: [".ts"], // Jest must treat .ts as ESM
};
