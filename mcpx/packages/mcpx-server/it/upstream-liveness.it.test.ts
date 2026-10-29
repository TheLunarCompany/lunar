import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createServer } from "http";
import { AddressInfo } from "net";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { withAsyncPolling } from "@aigw/core/time";
import { resetEnv } from "../src/env.js";
import { TargetServer } from "../src/model/target-servers.js";
import { getTestHarness, MCPX_BASE_URL, TestHarness } from "./utils.js";

const SERVER_NAME = "no-ping-upstream";
const PING_429_SERVER_NAME = "ping-429-upstream";
const TOOL_429_SERVER_NAME = "tool-429-upstream";
const PING_INTERVAL_MS = 200;
const FAILURE_THRESHOLD = 3;

interface Upstream {
  name: string;
  url: string;
  // Answers 503 from now on. Closing the socket would be closer to a crash, but
  // undici's error is created outside jest's realm and fails instanceof Error.
  takeDown: () => void;
  pingRequests: () => number;
  stop: () => Promise<void>;
}

interface UpstreamOptions {
  name: string;
  withPing: boolean;
  // JSON-RPC methods answered with HTTP 429 instead of reaching the MCP server.
  rateLimitedMethods: ReadonlySet<string>;
}

const jsonRpcMethodSchema = z.object({ method: z.string() });

// A streamable-http upstream that answers tool calls, and ping only when
// `withPing` is set (many non-SDK servers don't). Stateless: a fresh MCP server per request.
async function startUpstream(options: UpstreamOptions): Promise<Upstream> {
  const health = { down: false, pingRequests: 0 };
  const app = express();
  app.use(express.json());
  app.all("/mcp", async (req, res) => {
    const parsed = jsonRpcMethodSchema.safeParse(req.body);
    const method = parsed.success ? parsed.data.method : undefined;
    if (method === "ping") health.pingRequests++;
    if (health.down) {
      res.status(503).end();
      return;
    }
    if (method !== undefined && options.rateLimitedMethods.has(method)) {
      res.status(429).send("Rate limit exceeded");
      return;
    }
    const mcp = new McpServer({ name: options.name, version: "1.0.0" });
    mcp.registerTool(
      "echo",
      { inputSchema: { message: z.string() } },
      async ({ message }) => ({ content: [{ type: "text", text: message }] }),
    );
    if (!options.withPing) mcp.server.removeRequestHandler("ping");
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => void transport.close());
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  return {
    name: options.name,
    url: `http://localhost:${port}/mcp`,
    takeDown: () => {
      health.down = true;
    },
    pingRequests: () => health.pingRequests,
    stop: async () => {
      if (!httpServer.listening) return;
      httpServer.closeAllConnections();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readServerStateType(name: string): Promise<string | undefined> {
  const response = await fetch(`${MCPX_BASE_URL}/system-state`);
  const systemState = await response.json();
  const server = systemState.targetServers.find(
    (s: { name: string }) => s.name === name,
  );
  return server?.state?.type;
}

function toTargetServer(upstream: Upstream): TargetServer {
  return { type: "streamable-http", name: upstream.name, url: upstream.url };
}

// Failures spaced across ping ticks, like a dead server under light traffic.
// Distinct arguments so the tool-call cache cannot answer instead of the upstream.
async function callToolRepeatedly(
  harness: TestHarness,
  name: string,
  count: number,
): Promise<void> {
  for (const attempt of Array.from({ length: count }, (_, i) => i)) {
    await harness.client
      .callTool({
        name: `${name}__echo`,
        arguments: { message: `attempt-${attempt}` },
      })
      .catch(() => undefined);
    await waitFor(PING_INTERVAL_MS * 1.5);
  }
}

async function expectConnectionFailed(name: string): Promise<void> {
  const finalState = await withAsyncPolling({
    maxAttempts: 30,
    sleepTimeMs: 100,
    getValue: () => readServerStateType(name),
    found: (state): state is "connection-failed" =>
      state === "connection-failed",
  });
  expect(finalState).toBe("connection-failed");
}

describe("Upstream liveness", () => {
  const holder: {
    harness?: TestHarness;
    upstream?: Upstream;
    ping429Upstream?: Upstream;
    tool429Upstream?: Upstream;
  } = {};

  beforeAll(async () => {
    const [upstream, ping429Upstream, tool429Upstream] = await Promise.all([
      startUpstream({
        name: SERVER_NAME,
        withPing: false,
        rateLimitedMethods: new Set(),
      }),
      startUpstream({
        name: PING_429_SERVER_NAME,
        withPing: true,
        rateLimitedMethods: new Set(["ping"]),
      }),
      startUpstream({
        name: TOOL_429_SERVER_NAME,
        withPing: false,
        rateLimitedMethods: new Set(["tools/call"]),
      }),
    ]);
    const upstreams = [upstream, ping429Upstream, tool429Upstream];
    process.env["UPSTREAM_PING_INTERVAL_MS"] = String(PING_INTERVAL_MS);
    process.env["UPSTREAM_PING_TIMEOUT_MS"] = "500";
    process.env["UPSTREAM_PING_FAILURE_THRESHOLD"] = String(FAILURE_THRESHOLD);
    process.env["UPSTREAM_RECONNECT_BASE_DELAY_MS"] = "100";
    resetEnv();

    const harness = getTestHarness({
      targetServers: upstreams.map(toTargetServer),
      catalogItems: upstreams.map((u) => ({
        id: uuidv7(),
        name: u.name,
        displayName: u.name,
        config: { type: "streamable-http", url: u.url },
      })),
    });
    await harness.initialize("StreamableHTTP");
    holder.harness = harness;
    holder.upstream = upstream;
    holder.ping429Upstream = ping429Upstream;
    holder.tool429Upstream = tool429Upstream;
  });

  afterAll(async () => {
    await holder.harness?.shutdown();
    await holder.upstream?.stop();
    await holder.ping429Upstream?.stop();
    await holder.tool429Upstream?.stop();
    delete process.env["UPSTREAM_PING_INTERVAL_MS"];
    delete process.env["UPSTREAM_PING_TIMEOUT_MS"];
    delete process.env["UPSTREAM_PING_FAILURE_THRESHOLD"];
    delete process.env["UPSTREAM_RECONNECT_BASE_DELAY_MS"];
    resetEnv();
  });

  it("declares the upstream unreachable after repeated failed tool calls", async () => {
    const { harness, upstream } = holder;
    if (!harness || !upstream) throw new Error("harness not initialized");

    const healthy = await harness.client.callTool({
      name: `${SERVER_NAME}__echo`,
      arguments: { message: "hi" },
    });
    expect(healthy.isError).toBeFalsy();
    // Let the first ping run so MCPX has learned this server does not support ping.
    await waitFor(PING_INTERVAL_MS * 2);
    expect(await readServerStateType(SERVER_NAME)).toBe("connected");

    upstream.takeDown();

    await callToolRepeatedly(harness, SERVER_NAME, FAILURE_THRESHOLD);
    await expectConnectionFailed(SERVER_NAME);
  });

  it("stops pinging after a 429 and still declares the upstream unreachable after repeated failed tool calls", async () => {
    const { harness, ping429Upstream } = holder;
    if (!harness || !ping429Upstream)
      throw new Error("harness not initialized");

    await waitFor(PING_INTERVAL_MS * 5);
    expect(ping429Upstream.pingRequests()).toBe(1);
    expect(await readServerStateType(PING_429_SERVER_NAME)).toBe("connected");

    ping429Upstream.takeDown();

    await callToolRepeatedly(harness, PING_429_SERVER_NAME, FAILURE_THRESHOLD);
    await expectConnectionFailed(PING_429_SERVER_NAME);
  });

  it("keeps the upstream connected through repeated tool-call 429s", async () => {
    const { harness } = holder;
    if (!harness) throw new Error("harness not initialized");

    // No ping on this upstream, so only tool-call outcomes feed the counter.
    await callToolRepeatedly(
      harness,
      TOOL_429_SERVER_NAME,
      FAILURE_THRESHOLD * 2,
    );
    expect(await readServerStateType(TOOL_429_SERVER_NAME)).toBe("connected");
  });
});
