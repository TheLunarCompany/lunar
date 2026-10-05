import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createServer } from "http";
import { AddressInfo } from "net";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { withAsyncPolling } from "@mcpx/toolkit-core/time";
import { resetEnv } from "../src/env.js";
import { TargetServer } from "../src/model/target-servers.js";
import { getTestHarness, MCPX_BASE_URL, TestHarness } from "./utils.js";

const SERVER_NAME = "no-ping-upstream";
const PING_INTERVAL_MS = 200;
const FAILURE_THRESHOLD = 3;

interface Upstream {
  url: string;
  // Answers 503 from now on. Closing the socket would be closer to a crash, but
  // undici's error is created outside jest's realm and fails instanceof Error.
  takeDown: () => void;
  stop: () => Promise<void>;
}

// A streamable-http upstream that answers tool calls but not ping, like many
// non-SDK servers do. Stateless: a fresh MCP server per request.
async function startUpstreamWithoutPing(): Promise<Upstream> {
  const health = { down: false };
  const app = express();
  app.use(express.json());
  app.all("/mcp", async (req, res) => {
    if (health.down) {
      res.status(503).end();
      return;
    }
    const mcp = new McpServer({ name: SERVER_NAME, version: "1.0.0" });
    mcp.registerTool(
      "echo",
      { inputSchema: { message: z.string() } },
      async ({ message }) => ({ content: [{ type: "text", text: message }] }),
    );
    mcp.server.removeRequestHandler("ping");
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
    url: `http://localhost:${port}/mcp`,
    takeDown: () => {
      health.down = true;
    },
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

async function readServerStateType(): Promise<string | undefined> {
  const response = await fetch(`${MCPX_BASE_URL}/system-state`);
  const systemState = await response.json();
  const server = systemState.targetServers.find(
    (s: { name: string }) => s.name === SERVER_NAME,
  );
  return server?.state?.type;
}

describe("Upstream liveness for a server without ping support", () => {
  const holder: { harness?: TestHarness; upstream?: Upstream } = {};

  beforeAll(async () => {
    const upstream = await startUpstreamWithoutPing();
    process.env["UPSTREAM_PING_INTERVAL_MS"] = String(PING_INTERVAL_MS);
    process.env["UPSTREAM_PING_TIMEOUT_MS"] = "500";
    process.env["UPSTREAM_PING_FAILURE_THRESHOLD"] = String(FAILURE_THRESHOLD);
    process.env["UPSTREAM_RECONNECT_BASE_DELAY_MS"] = "100";
    resetEnv();

    const targetServer: TargetServer = {
      type: "streamable-http",
      name: SERVER_NAME,
      url: upstream.url,
    };
    const harness = getTestHarness({
      targetServers: [targetServer],
      catalogItems: [
        {
          id: uuidv7(),
          name: SERVER_NAME,
          displayName: SERVER_NAME,
          config: { type: "streamable-http", url: upstream.url },
        },
      ],
    });
    await harness.initialize("StreamableHTTP");
    holder.harness = harness;
    holder.upstream = upstream;
  });

  afterAll(async () => {
    await holder.harness?.shutdown();
    await holder.upstream?.stop();
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
    expect(await readServerStateType()).toBe("connected");

    upstream.takeDown();

    // Failures spaced across ping ticks, like a dead server under light traffic.
    // Distinct arguments so the tool-call cache cannot answer instead of the upstream.
    for (const attempt of Array.from(
      { length: FAILURE_THRESHOLD },
      (_, i) => i,
    )) {
      await harness.client
        .callTool({
          name: `${SERVER_NAME}__echo`,
          arguments: { message: `attempt-${attempt}` },
        })
        .catch(() => undefined);
      await waitFor(PING_INTERVAL_MS * 1.5);
    }

    const finalState = await withAsyncPolling({
      maxAttempts: 30,
      sleepTimeMs: 100,
      getValue: readServerStateType,
      found: (state): state is "connection-failed" =>
        state === "connection-failed",
    });
    expect(finalState).toBe("connection-failed");
  });
});
