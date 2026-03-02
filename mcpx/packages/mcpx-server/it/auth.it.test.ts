import { buildApiKeyGuard } from "../src/server/auth.js";
import {
  buildConfig,
  getMcpxLogger,
  getTestHarness,
  TestHarness,
  transportTypes,
} from "./utils.js";
import { env, resetEnv } from "../src/env.js";

describe.each(transportTypes)("%s Router with auth guard", (transportType) => {
  const originalEnv = { ...process.env };
  beforeAll(() => {
    process.env["AUTH_KEY"] = "secret123";
    resetEnv();
  });
  afterAll(() => {
    process.env = { ...originalEnv };
    resetEnv();
    const mcpxLogger = getMcpxLogger();
    mcpxLogger.close();
  });

  const makeHarness = (extraHeaders: Record<string, string> = {}) => {
    const config = buildConfig({ auth: { enabled: true } });
    const mcpxLogger = getMcpxLogger();
    const authGuard = buildApiKeyGuard(config, mcpxLogger, env.AUTH_KEY);

    return getTestHarness({
      config,
      authGuard,
      clientConnectExtraHeaders: extraHeaders,
    });
  };

  interface Case {
    name: string;
    extraHeaders?: Record<string, string>;
    expectError: boolean;
    errorPattern?: RegExp;
  }
  const cases: Case[] = [
    {
      name: "API key is not passed",
      expectError: true,
      errorPattern: /401|Unauthorized/,
    },
    {
      name: "wrong API key is passed",
      extraHeaders: { "x-lunar-api-key": "wrong-key" },
      expectError: true,
      errorPattern: /403|Forbidden/,
    },
    {
      name: "right API key is passed",
      extraHeaders: { "x-lunar-api-key": "secret123" },
      expectError: false,
    },
  ];

  cases.forEach(({ name, extraHeaders, expectError, errorPattern }) => {
    describe(`when ${name}`, () => {
      let testHarness: TestHarness;

      beforeEach(async () => {
        testHarness = makeHarness(extraHeaders);
        await testHarness.initialize(transportType);
      });

      afterEach(async () => {
        await testHarness.shutdown();
      });

      const itText = `${
        expectError ? "rejects" : "allows"
      } client's connect request`;
      it(itText, async () => {
        if (expectError) {
          expect(testHarness.clientConnectError).toBeDefined();
          expect(testHarness.clientConnectError?.message).toMatch(
            errorPattern!,
          );
        } else {
          expect(testHarness.clientConnectError).toBeUndefined();
          await expect(testHarness.client.listTools()).resolves.not.toThrow();
        }
      });
    });
  });
});
