import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

function createTestMcpServer(): McpServer {
  const server = new McpServer({
    name: "test::echo",
    version: "1.0.0",
  });

  server.registerTool(
    "echo",
    {
      title: "Echo Tool",
      description: "Echoes back the provided message",
      inputSchema: { message: z.string() },
    },
    async ({ message }) => ({
      content: [{ type: "text", text: `Tool echo: ${message}` }],
    })
  );

  return server;
}

async function main(): Promise<void> {
  console.log("Starting test::echo MCP server...");
  const transport = new StdioServerTransport();
  const server = createTestMcpServer();
  await server.connect(transport);
  console.log("test::echo MCP server is running with Stdio transport.");
}

// Run
main().catch((error) => {
  console.log("Fatal error in main():", error);
  process.exit(1);
});
