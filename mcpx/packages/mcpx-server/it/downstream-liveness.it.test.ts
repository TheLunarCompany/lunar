import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { withAsyncPolling } from "@aigw/core/time";
import { resetEnv } from "../src/env.js";
import { getTestHarness, MCPX_BASE_URL, TestHarness } from "./utils.js";

const PING_INTERVAL_MS = 100;

type ConnectionState = "connected" | "unresponsive" | "disconnected";

async function readAgentState(sessionId: string): Promise<{
  clientCount: number;
  clusterCount: number;
  connectionState?: ConnectionState;
}> {
  const response = await fetch(`${MCPX_BASE_URL}/system-state`);
  const systemState = await response.json();
  return {
    clientCount: systemState.connectedClients.filter(
      (client: { sessionId: string }) => client.sessionId === sessionId,
    ).length,
    clusterCount: systemState.connectedClientClusters.filter(
      (cluster: { sessionIds: string[] }) =>
        cluster.sessionIds.includes(sessionId),
    ).length,
    connectionState: systemState.connectedClients.find(
      (client: { sessionId: string }) => client.sessionId === sessionId,
    )?.connectionState,
  };
}

async function readConnectionState(
  sessionId: string,
): Promise<ConnectionState | undefined> {
  return (await readAgentState(sessionId)).connectionState;
}

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Downstream (client) liveness over streamableHttp", () => {
  const holder: { harness?: TestHarness } = {};

  beforeAll(() => {
    process.env["PING_INTERVAL_MS"] = String(PING_INTERVAL_MS);
    process.env["PING_MAX_CONSECUTIVE_TIMEOUTS"] = "3";
    process.env["NOTIFICATION_STREAM_RECONNECT_GRACE_MS"] = "300";
    process.env["AGENT_SESSION_TTL_MIN"] = "1";
    process.env["KEEPALIVE_SWEEP_INTERVAL_MIN"] = "1";
    resetEnv();
  });

  afterAll(() => {
    delete process.env["PING_INTERVAL_MS"];
    delete process.env["PING_MAX_CONSECUTIVE_TIMEOUTS"];
    delete process.env["NOTIFICATION_STREAM_RECONNECT_GRACE_MS"];
    delete process.env["AGENT_SESSION_TTL_MIN"];
    delete process.env["KEEPALIVE_SWEEP_INTERVAL_MIN"];
    resetEnv();
  });

  afterEach(async () => {
    await holder.harness?.shutdown();
    holder.harness = undefined;
  });

  it("stays connected while the client actively calls tools, across several ping intervals", async () => {
    const harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
    holder.harness = harness;
    const sessionId = harness.client.transport?.sessionId;
    if (!sessionId) throw new Error("client did not receive a session id");

    for (let i = 0; i < 5; i++) {
      await harness.client.listTools();
      await waitFor(PING_INTERVAL_MS);
      expect(await readAgentState(sessionId)).toEqual({
        clientCount: 1,
        clusterCount: 1,
        connectionState: "connected",
      });
    }
  });

  it("reaps a client that answered pings and then stops answering", async () => {
    const harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
    holder.harness = harness;
    const sessionId = harness.client.transport?.sessionId;
    if (!sessionId) throw new Error("client did not receive a session id");

    // Answers first (so the server learns the client handles ping), then
    // hangs: never resolve, rather than reply or error, so the server times
    // out on a genuine miss instead of detecting "unsupported".
    let hang = false;
    let answered = 0;
    harness.client.setRequestHandler(PingRequestSchema, () => {
      if (hang) return new Promise(() => {});
      answered += 1;
      return {};
    });
    await withAsyncPolling({
      maxAttempts: 50,
      sleepTimeMs: 50,
      getValue: async () => answered,
      found: (n): n is number => n >= 2,
    });
    hang = true;

    const finalState = await withAsyncPolling({
      maxAttempts: 50,
      sleepTimeMs: 100,
      getValue: () => readConnectionState(sessionId),
      found: (state): state is "disconnected" => state === "disconnected",
    });
    expect(finalState).toBe("disconnected");
  });

  it("flags a client that hangs on ping from the start unresponsive but never reaps it", async () => {
    const harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
    holder.harness = harness;
    const sessionId = harness.client.transport?.sessionId;
    if (!sessionId) throw new Error("client did not receive a session id");

    harness.client.setRequestHandler(
      PingRequestSchema,
      () => new Promise(() => {}),
    );

    const unresponsive = await withAsyncPolling({
      maxAttempts: 50,
      sleepTimeMs: 100,
      getValue: () => readConnectionState(sessionId),
      found: (state): state is "unresponsive" => state === "unresponsive",
    });
    expect(unresponsive).toBe("unresponsive");

    // PING_MAX_CONSECUTIVE_TIMEOUTS=3 at 100ms would have reaped it by now.
    await waitFor(1000);
    expect((await readAgentState(sessionId)).connectionState).toBe(
      "unresponsive",
    );
  });

  it("becomes unresponsive, not disconnected, when the client's transport dies", async () => {
    const harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
    holder.harness = harness;
    const sessionId = harness.client.transport?.sessionId;
    if (!sessionId) throw new Error("client did not receive a session id");

    // The post-initialize notification stream opens in the background (fire
    // and forget on the SDK side); give it a moment to actually connect
    // before severing the transport, so the server's close handler fires.
    await waitFor(300);
    await harness.client.transport?.close();

    const unresponsive = await withAsyncPolling({
      maxAttempts: 150,
      sleepTimeMs: 50,
      getValue: () => readConnectionState(sessionId),
      found: (state): state is "unresponsive" => state === "unresponsive",
    });
    expect(unresponsive).toBe("unresponsive");

    await waitFor(1000);
    expect(await readAgentState(sessionId)).toEqual({
      clientCount: 1,
      clusterCount: 1,
      connectionState: "unresponsive",
    });
  });

  it("disconnects the client when it explicitly terminates its session (DELETE)", async () => {
    const harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP");
    holder.harness = harness;
    const sessionId = harness.client.transport?.sessionId;
    if (!sessionId) throw new Error("client did not receive a session id");

    const transport = harness.client.transport as StreamableHTTPClientTransport;
    await transport.terminateSession();

    const disconnected = await withAsyncPolling({
      maxAttempts: 50,
      sleepTimeMs: 50,
      getValue: () => readConnectionState(sessionId),
      found: (state): state is "disconnected" => state === "disconnected",
    });
    expect(disconnected).toBe("disconnected");
  });
});

const MCP_URL = `${MCPX_BASE_URL}/mcp`;
const PROTOCOL_VERSION = "2025-03-26";
const GRACE_MS = 300;
const JSON_AND_SSE = "application/json, text/event-stream";

async function initializeRawSession(): Promise<string> {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: JSON_AND_SSE },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "raw-liveness-it", version: "1.0.0" },
      },
    }),
  });
  const sessionId = response.headers.get("mcp-session-id");
  await response.text();
  if (!sessionId) {
    throw new Error(
      `initialize returned ${response.status} with no session id`,
    );
  }
  await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: JSON_AND_SSE,
      "mcp-session-id": sessionId,
      "mcp-protocol-version": PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  }).then((r) => r.text());
  return sessionId;
}

// Resolves once response headers arrive; abort() simulates a network drop.
async function openRawNotificationStream(
  sessionId: string,
  accept = "text/event-stream",
): Promise<{ status: number; abort: () => void }> {
  const controller = new AbortController();
  const response = await fetch(MCP_URL, {
    method: "GET",
    headers: {
      accept,
      "mcp-session-id": sessionId,
      "mcp-protocol-version": PROTOCOL_VERSION,
    },
    signal: controller.signal,
  });
  if (!response.ok) {
    await response.text(); // rejected GET: drain so the socket is released
  }
  return { status: response.status, abort: () => controller.abort() };
}

describe("Downstream notification stream lifecycle over streamableHttp", () => {
  const holder: { harness?: TestHarness } = {};

  beforeAll(() => {
    process.env["PING_INTERVAL_MS"] = "60000"; // no pings: judge by stream state only
    process.env["NOTIFICATION_STREAM_RECONNECT_GRACE_MS"] = String(GRACE_MS);
    process.env["AGENT_SESSION_TTL_MIN"] = "1";
    process.env["KEEPALIVE_SWEEP_INTERVAL_MIN"] = "1";
    resetEnv();
  });

  afterAll(() => {
    delete process.env["PING_INTERVAL_MS"];
    delete process.env["NOTIFICATION_STREAM_RECONNECT_GRACE_MS"];
    delete process.env["AGENT_SESSION_TTL_MIN"];
    delete process.env["KEEPALIVE_SWEEP_INTERVAL_MIN"];
    resetEnv();
  });

  afterEach(async () => {
    await holder.harness?.shutdown();
    holder.harness = undefined;
  });

  async function startRawSession(): Promise<string> {
    const harness = getTestHarness({ targetServers: [] });
    await harness.initialize("StreamableHTTP"); // boots MCPX; its SDK client is a separate session we ignore
    holder.harness = harness;
    return initializeRawSession();
  }

  it("stays connected when the notification stream drops and the client reopens it", async () => {
    const sessionId = await startRawSession();
    const first = await openRawNotificationStream(sessionId);
    expect(first.status).toBe(200);

    first.abort();
    await waitFor(GRACE_MS / 3);
    const second = await openRawNotificationStream(sessionId);
    expect(second.status).toBe(200);

    await waitFor(GRACE_MS * 2); // well past where the first stream's grace would have fired
    expect(await readAgentState(sessionId)).toEqual({
      clientCount: 1,
      clusterCount: 1,
      connectionState: "connected",
    });
    second.abort();
  });

  it("keeps the session, flagged unresponsive, when the stream drops and is never reopened", async () => {
    const sessionId = await startRawSession();
    const stream = await openRawNotificationStream(sessionId);
    expect(stream.status).toBe(200);

    stream.abort();
    const unresponsive = await withAsyncPolling({
      maxAttempts: 40,
      sleepTimeMs: 50,
      getValue: () => readConnectionState(sessionId),
      found: (state): state is "unresponsive" => state === "unresponsive",
    });
    expect(unresponsive).toBe("unresponsive");

    await waitFor(GRACE_MS * 3); // would have been closed under the old policy
    expect(await readAgentState(sessionId)).toEqual({
      clientCount: 1,
      clusterCount: 1,
      connectionState: "unresponsive",
    });
  });

  it("does not leave a session connected on a dead stream when the replacement GET is rejected", async () => {
    const sessionId = await startRawSession();
    const healthy = await openRawNotificationStream(sessionId);
    expect(healthy.status).toBe(200);

    // The replacement GET is rejected (client does not accept SSE → 406).
    // MCPX closes the previous standalone stream before handling it, so the
    // session has no open stream. Every SDK rejection of a GET also reports
    // through transport.onerror, which closes the whole session
    // (TransportError) — so the observable outcome is "disconnected", never a
    // "connected" session whose stream is gone. handleStreamableGet's own
    // "rejected GET is not an open stream" branch is a guard behind that; the
    // manager-level transitions it relies on are unit-tested. (409 only
    // occurs on a Last-Event-ID replay onto an active stream and takes the
    // same path.)
    const rejected = await openRawNotificationStream(
      sessionId,
      "application/json",
    );
    expect(rejected.status).toBeGreaterThanOrEqual(400);

    const finalState = await withAsyncPolling({
      maxAttempts: 40,
      sleepTimeMs: 50,
      getValue: () => readConnectionState(sessionId),
      found: (state): state is "disconnected" => state === "disconnected",
    });
    expect(finalState).toBe("disconnected");
    healthy.abort();
  });
});
