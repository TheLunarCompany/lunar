// The story:
// - We build a fake OAuth world: an AS with 2s tokens, an MCP server (RS)
//   (startMockOAuthServers).
// - The AS is strict: use a refresh token twice and the whole login dies
//   (exchangeRefreshToken).
// - MCPX logs in once, no browser (logIn).
// - Each round, we let the token die and fire 8 calls at once: all hit 401
//   (expireThenCallConcurrently).
// - Test 1, two rounds: every call works, one refresh per round.
// - Test 2, the AS hiccups with a 503: MCPX comes back, next round is clean
//   (failNextTokenRequest).
// - All of it runs twice: an AS that rotates (new refresh token each time,
//   Okta) and one that doesn't (same refresh token forever, Google).

import { v7 as uuidv7 } from "uuid";
import { resetEnv } from "../src/env.js";
import { TargetServer } from "../src/model/target-servers.js";
import {
  logIn,
  MockOAuthServers,
  readServerStateType,
  startMockOAuthServers,
  waitForConnected,
} from "./mock-oauth-servers.js";
import { getTestHarness, TestHarness } from "./utils.js";

const SERVER_NAME = "oauth-protected-mcp";
const ACCESS_TOKEN_TTL_MS = 2000;
const CONCURRENT_CALLS = 8;

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Distinct arguments per call so the tool-call cache cannot answer for the upstream.
async function callToolConcurrently(props: {
  harness: TestHarness;
  round: number;
}): Promise<boolean[]> {
  const { harness, round } = props;
  return Promise.all(
    Array.from({ length: CONCURRENT_CALLS }, (_, i) =>
      harness.client
        .callTool({
          name: `${SERVER_NAME}__whoami`,
          arguments: { n: round * 100 + i },
        })
        .then(
          (result) => result.isError === true,
          () => true,
        ),
    ),
  );
}

// Waits out the access token, then fires the burst, so every call lands on an expired token.
async function expireThenCallConcurrently(props: {
  harness: TestHarness;
  round: number;
}): Promise<boolean[]> {
  await waitFor(ACCESS_TOKEN_TTL_MS + 300);
  return callToolConcurrently(props);
}

describe.each([
  { kind: "rotating", rotate: true },
  { kind: "non-rotating", rotate: false },
])("Concurrent OAuth token refresh against a $kind AS", ({ rotate }) => {
  const holder: { harness?: TestHarness; oauthServers?: MockOAuthServers } = {};
  const noErrors = Array(CONCURRENT_CALLS).fill(false);

  beforeAll(async () => {
    const oauthServers = await startMockOAuthServers({
      rotate,
      accessTokenTtlMs: ACCESS_TOKEN_TTL_MS,
    });
    // Pings would refresh too and blur the per-expiry refresh count.
    process.env["UPSTREAM_PING_INTERVAL_MS"] = "0";
    resetEnv();

    const targetServer: TargetServer = {
      type: "streamable-http",
      name: SERVER_NAME,
      url: oauthServers.resourceServerUrl,
    };
    const harness = getTestHarness({
      targetServers: [targetServer],
      catalogItems: [
        {
          id: uuidv7(),
          name: SERVER_NAME,
          displayName: SERVER_NAME,
          config: {
            type: "streamable-http",
            url: oauthServers.resourceServerUrl,
          },
        },
      ],
    });
    await harness.initialize("StreamableHTTP");
    await logIn({ harness, serverName: SERVER_NAME });
    holder.harness = harness;
    holder.oauthServers = oauthServers;
  });

  afterAll(async () => {
    await holder.harness?.shutdown();
    await holder.oauthServers?.stop();
    delete process.env["UPSTREAM_PING_INTERVAL_MS"];
    resetEnv();
  });

  it("refreshes once per expiry and stays connected when concurrent calls hit an expired token", async () => {
    const { harness, oauthServers } = holder;
    if (!harness || !oauthServers) throw new Error("harness not initialized");

    expect(await waitForConnected(SERVER_NAME)).toBe("connected");
    expect(oauthServers.refreshes).toEqual({
      ok: 0,
      reused: 0,
      unknown: 0,
      failed: 0,
    });

    // Two expiries: the second proves the next refresh really goes out, rotated or not.
    for (const round of [1, 2]) {
      const errors = await expireThenCallConcurrently({ harness, round });

      expect(errors).toEqual(noErrors);
      expect(oauthServers.refreshes).toEqual({
        ok: round,
        reused: 0,
        unknown: 0,
        failed: 0,
      });
      expect(await readServerStateType(SERVER_NAME)).toBe("connected");
    }
  }, 30_000);

  it("recovers from a transient 503 on the token endpoint instead of replaying it", async () => {
    const { harness, oauthServers } = holder;
    if (!harness || !oauthServers) throw new Error("harness not initialized");
    const before = { ...oauthServers.refreshes };

    oauthServers.failNextTokenRequest();
    // Calls in flight when silent re-auth swaps the client may fail; the server must come back.
    await expireThenCallConcurrently({ harness, round: 3 });
    expect(await waitForConnected(SERVER_NAME)).toBe("connected");

    const errors = await expireThenCallConcurrently({ harness, round: 4 });

    expect(errors).toEqual(noErrors);
    expect(oauthServers.refreshes).toEqual({
      ...before,
      ok: before.ok + 2,
      failed: 1,
    });
    expect(await readServerStateType(SERVER_NAME)).toBe("connected");
  }, 30_000);
});
