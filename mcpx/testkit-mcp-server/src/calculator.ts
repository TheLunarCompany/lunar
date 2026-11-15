import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

function createTestMcpServer(): McpServer {
  const server = new McpServer({
    name: "test::calculator",
    version: "1.0.0",
  });

  server.registerTool(
    "add",
    {
      title: "Addition Tool",
      description: "Adds two numbers together",
      inputSchema: { a: z.number(), b: z.number() },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: `Result: ${a + b}` }],
    })
  );

  server.registerTool(
    "powerOfTwo",
    {
      title: "Power of Two Tool",
      description: "Calculates the power of two for a given number",
      inputSchema: { base: z.number() },
    },
    async ({ base }) => ({
      content: [{ type: "text", text: `Result: ${Math.pow(base, 2)}` }],
    })
  );

  return server;
}

async function main(): Promise<void> {
  console.log("Starting test::calculator MCP server...");
  const transport = new StdioServerTransport();
  const server = createTestMcpServer();
  await server.connect(transport);
  console.log("test::calculator MCP server is running with Stdio transport.");
}

// Run
main().catch((error) => {
  console.log("Fatal error in main():", error);
  process.exit(1);
});
