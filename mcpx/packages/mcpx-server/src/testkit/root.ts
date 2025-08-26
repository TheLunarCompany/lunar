import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const monorepoRoot = resolve(__dirname, "..", "..", "..", "..");

export const TESTKIT_SERVER_SRC = join(monorepoRoot, "testkit-mcp-server");
export const TESTKIT_SERVER_ECHO = join(TESTKIT_SERVER_SRC, "dist", "echo.js");
export const TESTKIT_SERVER_CALCULATOR = join(
  TESTKIT_SERVER_SRC,
  "dist",
  "calculator.js",
);
