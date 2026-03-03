import { resolve, join } from "node:path";

// Find monorepo root relative to the mcpx-server package directory
// This works because process.cwd() is the package directory when running tests
const packageDir = resolve(process.cwd());
const monorepoRoot = resolve(packageDir, "..", "..");

export const TESTKIT_SERVER_SRC = join(monorepoRoot, "testkit-mcp-server");
export const TESTKIT_SERVER_ECHO = join(TESTKIT_SERVER_SRC, "dist", "echo.js");
export const TESTKIT_SERVER_CALCULATOR = join(
  TESTKIT_SERVER_SRC,
  "dist",
  "calculator.js",
);
export const TESTKIT_SERVER_ENV_READER = join(
  TESTKIT_SERVER_SRC,
  "dist",
  "env-reader.js",
);
