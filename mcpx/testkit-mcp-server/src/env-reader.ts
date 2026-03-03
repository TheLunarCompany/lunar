import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

function createEnvReaderServer(): McpServer {
  const server = new McpServer({
    name: "test::env-reader",
    version: "1.0.0",
  });

  server.registerTool(
    "getEnv",
    {
      title: "Get Environment Variable",
      description: "Returns the value of a specified environment variable",
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const value = process.env[name];
      return {
        content: [
          {
            type: "text",
            text: value !== undefined ? value : `ENV_NOT_FOUND:${name}`,
          },
        ],
      };
    }
  );

  return server;
}

async function main(): Promise<void> {
  console.log("Starting test::env-reader MCP server...");
  const transport = new StdioServerTransport();
  const server = createEnvReaderServer();
  await server.connect(transport);
  console.log("test::env-reader MCP server is running with Stdio transport.");
}

main().catch((error) => {
  console.log("Fatal error in main():", error);
  process.exit(1);
});
