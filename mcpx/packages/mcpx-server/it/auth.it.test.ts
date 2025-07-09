import { buildApiKeyGuard } from "../src/server/auth.js";
import {
  buildConfig,
  getMcpxLogger,
  getTestHarness,
  TestHarness,
  transportTypes,
} from "./utils.js";

describe.each(transportTypes)("%s Router with auth guard", (transportType) => {
  const config = buildConfig({ auth: { enabled: true } });
  const mcpxLogger = getMcpxLogger();
  const authGuard = buildApiKeyGuard(config, mcpxLogger, "secret123");

  const makeHarness = (extraHeaders: Record<string, string> = {}) =>
    getTestHarness({
      config,
      authGuard,
      clientConnectExtraHeaders: extraHeaders,
    });

  interface Case {
    name: string;
    extraHeaders?: Record<string, string>;
    expectError: boolean;
    status?: number;
  }
  const cases: Case[] = [
    { name: "API key is not passed", expectError: true, status: 401 },
    {
      name: "wrong API key is passed",
      extraHeaders: { "x-lunar-api-key": "wrong-key" },
      expectError: true,
      status: 403,
    },
    {
      name: "right API key is passed",
      extraHeaders: { "x-lunar-api-key": "secret123" },
      expectError: false,
    },
  ];

  cases.forEach(({ name, extraHeaders, expectError, status }) => {
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
      } client's connect request${status ? ` with status code ${status}` : ""}`;
      it(itText, async () => {
        if (expectError) {
          expect(testHarness.clientConnectError).toBeDefined();
          expect(testHarness.clientConnectError?.message).toMatch(
            new RegExp(status!.toString()),
          );
        } else {
          expect(testHarness.clientConnectError).toBeUndefined();
          await expect(testHarness.client.listTools()).resolves.not.toThrow();
        }
      });
    });
  });
});
