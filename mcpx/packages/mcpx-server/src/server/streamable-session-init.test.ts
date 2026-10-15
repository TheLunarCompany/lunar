import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { markSessionInitialized } from "./streamable-session-init.js";

// Pins the SDK behavior that session restoration depends on, so an SDK bump
// that moves its private state fails here, not in production.
// https://github.com/modelcontextprotocol/typescript-sdk/issues/1786
describe("markSessionInitialized", () => {
  const sessionId = "restored-session";
  const closers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  async function startServer(params: {
    markInitialized: boolean;
  }): Promise<string> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      enableJsonResponse: true,
    });
    if (params.markInitialized) {
      markSessionInitialized(transport, sessionId);
    }
    const mcpServer = new McpServer({ name: "test", version: "1.0.0" });
    mcpServer.registerTool("ping", { description: "ping" }, async () => ({
      content: [],
    }));
    await mcpServer.connect(transport);

    const httpServer = createServer((req, res) => {
      void transport.handleRequest(req, res);
    });
    await new Promise<void>((resolve) =>
      httpServer.listen(0, "127.0.0.1", resolve),
    );
    closers.push(async () => {
      await mcpServer.close();
      httpServer.closeAllConnections();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });

    const { port } = httpServer.address() as AddressInfo;
    return `http://127.0.0.1:${port}/mcp`;
  }

  function listToolsWithoutInitialize(url: string): Promise<Response> {
    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
  }

  it("lets a marked transport serve a request without initialize", async () => {
    const url = await startServer({ markInitialized: true });

    const response = await listToolsWithoutInitialize(url);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      result: { tools: [{ name: "ping" }] },
    });
  });

  it("control: the SDK rejects the same request on an unmarked transport", async () => {
    const url = await startServer({ markInitialized: false });

    const response = await listToolsWithoutInitialize(url);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { message: expect.stringContaining("Server not initialized") },
    });
  });

  it("throws when the transport does not have the expected SDK internals", () => {
    const notATransport = {} as StreamableHTTPServerTransport;

    expect(() => markSessionInitialized(notATransport, sessionId)).toThrow(
      "MCP SDK transport internals changed",
    );
  });
});
