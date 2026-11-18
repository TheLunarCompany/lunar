// A server that connects while the Hub is away keeps its stored tokens: the
// failed token read leaves it connection-failed, and the reconnect backoff
// retries it once the Hub is back.

import { resetEnv } from "../src/env.js";
import { withAsyncPolling } from "@aigw/core/time";
import { createServer } from "node:net";
import { AddressInfo } from "node:net";
import { v7 as uuidv7 } from "uuid";
import { TargetServer } from "../src/model/target-servers.js";
import {
  logIn,
  MockOAuthServers,
  startMockOAuthServers,
} from "./mock-oauth-servers.js";
import { RequestHold } from "./request-hold.js";
import { getTestHarness, TestHarness } from "./utils.js";

const SERVER_NAME = "dcr-oauth-mcp";
// The setup owner ID the harness's mock Hub accepts (see getTestHarness).
const HUB_SETUP_OWNER_ID = "it-run";

async function startMcpx(props: {
  url: string;
  targetServers: TargetServer[];
}): Promise<TestHarness> {
  const { url, targetServers } = props;
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, resolve));
  const { port } = reservation.address() as AddressInfo;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  return getTestHarness({
    mcpxPort: port,
    hubPort: 0,
    targetServers,
    catalogItems: [
      {
        id: uuidv7(),
        name: SERVER_NAME,
        displayName: SERVER_NAME,
        config: { type: "streamable-http", url },
      },
    ],
  });
}

async function readState(harness: TestHarness): Promise<string | undefined> {
  const { port } = harness.server.address() as AddressInfo;
  const response = await fetch(`http://localhost:${port}/system-state`);
  const state = await response.json();
  return state.targetServers.find(
    (server: { name: string }) => server.name === SERVER_NAME,
  )?.state?.type;
}

async function waitForState(
  harness: TestHarness,
  expected: string,
): Promise<void> {
  await withAsyncPolling({
    maxAttempts: 80,
    sleepTimeMs: 100,
    getValue: () => readState(harness),
    found: (state): state is string => state === expected,
  });
}

// Keep the Hub unavailable until the test explicitly restores it.
async function dropHubForAWhile(harness: TestHarness): Promise<() => void> {
  const { mockHubServer, services } = harness;
  mockHubServer.setValidTokens([]);
  for (const socketId of mockHubServer.getConnectedClients()) {
    mockHubServer.disconnectClient(socketId);
  }
  await withAsyncPolling({
    maxAttempts: 50,
    sleepTimeMs: 20,
    getValue: async () => services.hubService.status.status,
    found: (status): status is "unauthenticated" =>
      status === "unauthenticated",
  });
  return () => mockHubServer.setValidTokens([HUB_SETUP_OWNER_ID]);
}

// Adds the server while the Hub is away, so its first token read fails.
// Returns the function that brings the Hub back.
async function addWhileHubIsAway(
  harness: TestHarness,
  targetServer: TargetServer,
): Promise<() => void> {
  const restoreHub = await dropHubForAWhile(harness);
  await harness.services.upstreamHandler.addClient(targetServer);
  expect(await readState(harness)).toBe("connection-failed");
  return restoreHub;
}

describe("A server that connects while the Hub is away", () => {
  const holder: {
    harnesses: TestHarness[];
    oauthServers?: MockOAuthServers;
  } = { harnesses: [] };

  async function emptyHarness(): Promise<{
    harness: TestHarness;
    targetServer: TargetServer;
    oauthServers: MockOAuthServers;
  }> {
    const oauthServers = await startMockOAuthServers({
      rotate: false,
      accessTokenTtlMs: 60_000,
    });
    holder.oauthServers = oauthServers;
    const harness = await startMcpx({
      url: oauthServers.resourceServerUrl,
      targetServers: [],
    });
    holder.harnesses.push(harness);
    await harness.initialize("StreamableHTTP");
    return {
      harness,
      targetServer: {
        type: "streamable-http",
        name: SERVER_NAME,
        url: oauthServers.resourceServerUrl,
      },
      oauthServers,
    };
  }

  // Signs in on one instance, then starts a fresh one whose Hub holds those
  // tokens, with the server not added yet.
  async function harnessWithStoredTokens(): Promise<{
    harness: TestHarness;
    targetServer: TargetServer;
    oauthServers: MockOAuthServers;
  }> {
    const oauthServers = await startMockOAuthServers({
      rotate: false,
      accessTokenTtlMs: 60_000,
    });
    holder.oauthServers = oauthServers;
    const targetServer: TargetServer = {
      type: "streamable-http",
      name: SERVER_NAME,
      url: oauthServers.resourceServerUrl,
    };

    const before = await startMcpx({
      url: oauthServers.resourceServerUrl,
      targetServers: [targetServer],
    });
    holder.harnesses.push(before);
    await before.initialize("StreamableHTTP");
    await logIn({ harness: before, serverName: SERVER_NAME });
    await waitForState(before, "connected");
    const storedTokens = before.mockHubServer.getOAuthTokens();
    expect(storedTokens.has(`${SERVER_NAME}:tokens`)).toBe(true);
    await before.shutdown();
    holder.harnesses = [];

    const harness = await startMcpx({
      url: oauthServers.resourceServerUrl,
      targetServers: [],
    });
    holder.harnesses.push(harness);
    harness.mockHubServer.seedOAuthTokens(storedTokens);
    await harness.initialize("StreamableHTTP");
    return { harness, targetServer, oauthServers };
  }

  async function waitForHub(harness: TestHarness): Promise<void> {
    await withAsyncPolling({
      maxAttempts: 80,
      sleepTimeMs: 100,
      getValue: async () => harness.services.hubService.status.status,
      found: (status): status is "authenticated" => status === "authenticated",
    });
  }

  // Call before starting a harness: the reconnect delay is read at startup.
  function useReconnectDelay(ms: number): void {
    process.env["UPSTREAM_RECONNECT_BASE_DELAY_MS"] = String(ms);
    resetEnv();
  }

  const originalReconnectDelay =
    process.env["UPSTREAM_RECONNECT_BASE_DELAY_MS"];
  afterEach(async () => {
    if (originalReconnectDelay === undefined) {
      delete process.env["UPSTREAM_RECONNECT_BASE_DELAY_MS"];
    } else {
      process.env["UPSTREAM_RECONNECT_BASE_DELAY_MS"] = originalReconnectDelay;
    }
    resetEnv();
    await Promise.all(holder.harnesses.map((harness) => harness.shutdown()));
    holder.harnesses = [];
    await holder.oauthServers?.stop();
  });

  it("connects with its stored tokens on the reconnect after the Hub is back", async () => {
    useReconnectDelay(200);
    const { harness, targetServer } = await harnessWithStoredTokens();

    const restoreHub = await addWhileHubIsAway(harness, targetServer);
    restoreHub();
    await waitForState(harness, "connected");
  }, 30_000);

  it("goes to pending-auth on the reconnect when there are no tokens, and stops retrying", async () => {
    useReconnectDelay(200);
    const { harness, targetServer } = await emptyHarness();

    const restoreHub = await addWhileHubIsAway(harness, targetServer);
    restoreHub();
    await waitForState(harness, "pending-auth");
    expect(
      harness.services.upstreamHandler.isReconnectQueued(SERVER_NAME),
    ).toBe(false);
  }, 15_000);

  it("drops a queued reconnect once the server reaches pending-auth another way", async () => {
    // Long enough that the queued reconnect cannot fire during the test.
    useReconnectDelay(60_000);
    const { harness, targetServer } = await emptyHarness();
    const { upstreamHandler } = harness.services;
    const restoreHub = await addWhileHubIsAway(harness, targetServer);
    expect(upstreamHandler.isReconnectQueued(SERVER_NAME)).toBe(true);
    restoreHub();
    await waitForHub(harness);

    // A reload connects the server again, outside the reconnect loop.
    await upstreamHandler.reloadClients();
    expect(await readState(harness)).toBe("pending-auth");
    expect(upstreamHandler.isReconnectQueued(SERVER_NAME)).toBe(false);
  }, 15_000);

  it("keeps the state and the queued reconnect when a sign-in fails", async () => {
    // Long enough that the queued reconnect cannot fire during the test.
    useReconnectDelay(60_000);
    const { harness, targetServer, oauthServers } =
      await harnessWithStoredTokens();
    const { upstreamHandler } = harness.services;
    const restoreHub = await addWhileHubIsAway(harness, targetServer);
    restoreHub();
    await waitForHub(harness);

    // With a 503 on refresh, the SDK starts a sign-in although the stored
    // tokens still work. The sign-in then fails on its code exchange.
    oauthServers.failNextTokenRequest();
    const { authorizationUrl } =
      await upstreamHandler.initiateOAuthForServer(SERVER_NAME);
    const state = new URL(authorizationUrl).searchParams.get("state");
    if (!state) throw new Error(`No state in ${authorizationUrl}`);
    await expect(
      upstreamHandler.completeOAuthByState(state, "not-a-code"),
    ).rejects.toThrow();

    expect(await readState(harness)).toBe("connection-failed");
    expect(upstreamHandler.isReconnectQueued(SERVER_NAME)).toBe(true);
  }, 30_000);

  it.each(["remove", "shutdown"] as const)(
    "does not restore a server after %s during its reconnect",
    async (action) => {
      useReconnectDelay(200);
      const { harness, targetServer } = await emptyHarness();
      const { upstreamHandler } = harness.services;
      const restoreHub = await addWhileHubIsAway(harness, targetServer);
      const read = harness.mockHubServer.holdNextTokenLoad();
      restoreHub();
      try {
        await read.entered;
        if (action === "remove") {
          await upstreamHandler.removeClient(SERVER_NAME);
        } else {
          await upstreamHandler.shutdown();
        }
      } finally {
        read.release();
      }
      await upstreamHandler.reconnectSettled(SERVER_NAME);
      expect(await readState(harness)).toBe(
        action === "remove" ? undefined : "connecting",
      );
      expect(upstreamHandler.isReconnectQueued(SERVER_NAME)).toBe(false);
    },
    15_000,
  );

  it.each([
    { during: "loads tools", method: "tools/list", status: undefined },
    { during: "is rate limited", method: "initialize", status: 429 },
  ])(
    "does not restore a server removed while its reconnect $during",
    async ({ method, status }) => {
      useReconnectDelay(200);
      const { harness, targetServer, oauthServers } =
        await harnessWithStoredTokens();
      const { upstreamHandler } = harness.services;
      const restoreHub = await addWhileHubIsAway(harness, targetServer);
      const request = oauthServers.holdNextMcpRequest(method);
      restoreHub();
      try {
        await request.entered;
        await upstreamHandler.removeClient(SERVER_NAME);
        if (status !== undefined) oauthServers.setMcpFault({ status });
      } finally {
        request.release();
      }
      await upstreamHandler.reconnectSettled(SERVER_NAME);
      expect(await readState(harness)).toBeUndefined();
      expect(harness.services.capabilityRegistry.servers.has(SERVER_NAME)).toBe(
        false,
      );
      expect(upstreamHandler.isReconnectQueued(SERVER_NAME)).toBe(false);
      const tools = await harness.client.listTools();
      expect(tools.tools.some((tool) => tool.name.includes("whoami"))).toBe(
        false,
      );
    },
    30_000,
  );

  it("keeps a sign-in that finishes while a reconnect is still running", async () => {
    useReconnectDelay(200);
    const { harness, targetServer, oauthServers } = await emptyHarness();
    const { upstreamHandler } = harness.services;
    const restoreHub = await addWhileHubIsAway(harness, targetServer);
    // The reconnect waits on its token read until the sign-in saved tokens.
    const reconnectRead = harness.mockHubServer.holdNextTokenLoad();
    const signInTools = oauthServers.holdNextMcpRequest("tools/list");
    let reconnectConnect: RequestHold | undefined;
    restoreHub();
    await reconnectRead.entered;
    const signingIn = logIn({ harness, serverName: SERVER_NAME });
    try {
      await signInTools.entered;
      // The sign-in is past its initialize, so the next one is the reconnect's.
      reconnectConnect = oauthServers.holdNextMcpRequest("initialize");
      reconnectRead.release();
      await reconnectConnect.entered;
      expect(await readState(harness)).toBe("connecting");
      signInTools.release();
      await signingIn;
      expect(await readState(harness)).toBe("connected");
      // A stale result that still landed would show as connection-failed.
      oauthServers.setMcpFault({ status: 500 });
    } finally {
      reconnectRead.release();
      signInTools.release();
      reconnectConnect?.release();
      await signingIn;
    }
    await upstreamHandler.reconnectSettled(SERVER_NAME);
    oauthServers.clearMcpFault();
    expect(await readState(harness)).toBe("connected");
    expect(
      harness.services.capabilityRegistry.servers.get(SERVER_NAME)?.tools,
    ).toEqual([
      expect.objectContaining({
        origin: "upstream",
        definition: expect.objectContaining({ name: "whoami" }),
      }),
    ]);
    const tools = await harness.client.listTools();
    expect(tools.tools.some((tool) => tool.name.includes("whoami"))).toBe(true);
  }, 15_000);
});
