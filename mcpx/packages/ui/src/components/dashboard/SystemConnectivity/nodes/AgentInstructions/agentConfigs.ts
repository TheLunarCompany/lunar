import { getMcpxServerURLSync } from "@/config/api-config";

// Config type for Cursor/Claude Desktop agents
export type McpServersConfig = {
  mcpServers: Record<string, unknown>;
};

// Config type for VSCode
export type VSCodeConfig = {
  servers: Record<string, unknown>;
};

// Config type for custom MCP client agents
export type CustomMcpConfig = {
  description: string;
  streamableHttpExample: { transport: string; code: string };
  sseExample: { transport: string; code: string };
  clientSetup: { code: string };
};

export interface AgentType {
  value: string;
  label: string;
  description: string;
  getConfig: () => McpServersConfig | VSCodeConfig | CustomMcpConfig;
}

export const getAgentConfigs = (): AgentType[] => {
  return [
    {
      value: "cursor",
      label: "Cursor",
      description: "Connect Cursor to MCPX for MCP tool integration",
      getConfig: () => {
        const mcpxUrl = getMcpxServerURLSync() + "/mcp";
        return {
          mcpServers: {
            mcpx: {
              url: mcpxUrl,
              headers: {
                "x-lunar-consumer-tag": "Cursor",
              },
            },
          },
        };
      },
    },
    {
      value: "claude",
      label: "Claude Desktop",
      description: "Connect Claude Desktop to MCPX for MCP tool integration",
      getConfig: () => {
        const mcpxUrl = getMcpxServerURLSync() + "/mcp";
        return {
          mcpServers: {
            mcpx: {
              command: "npx",
              args: [
                "mcp-remote@0.1.21",
                mcpxUrl,
                "--header",
                "x-lunar-consumer-tag: Claude",
              ],
            },
          },
        };
      },
    },
    {
      value: "vscode",
      label: "VSCode",
      description: "Connect VSCode to MCPX for MCP tool integration",
      getConfig: () => {
        const mcpxUrl = getMcpxServerURLSync() + "/mcp";
        return {
          servers: {
            mcpx: {
              url: mcpxUrl,
              headers: {
                "x-lunar-consumer-tag": "vscode",
              },
              type: "http",
            },
          },
        };
      },
    },
    {
      value: "copilot",
      label: "Copilot",
      description: "Connect Copilot to MCPX for MCP tool integration",
      getConfig: () => {
        const mcpxUrl = getMcpxServerURLSync() + "/mcp";
        return {
          servers: {
            mcpx: {
              url: mcpxUrl,
              headers: {
                "x-lunar-consumer-tag": "copilot",
              },
              type: "http",
            },
          },
        };
      },
    },
    {
      value: "custom",
      label: "Custom MCP Client",
      description: "Connect your custom MCP client to MCPX",
      getConfig: () => ({
        description:
          "MCPX is essentially a MCP server, just like any other. Connecting to it using the SDK is similar to any MCP integration. Because MCPX adopts a remote-first approach - that is, it is meant to be deployed on the cloud - it accepts SSE connections and not stdio ones.",
        streamableHttpExample: {
          transport: "StreamableHttp",
          code: `const transport = new StreamableHTTPClientTransport(
  new URL(\`\${MCPX_HOST}/mcp\`),
  {
    requestInit: {
      headers: {
        "x-lunar-consumer-tag": "my_agent_name",
      },
    },
  }
);`,
        },
        sseExample: {
          transport: "SSE",
          code: `const transport = new SSEClientTransport(new URL(\`\${MCPX_HOST}/sse\`), {
  eventSourceInit: {
    fetch: (url, init) => {
      const headers = new Headers(init?.headers);
      const consumerTag = "my_agent_name";
      headers.set("x-lunar-consumer-tag", consumerTag);
      return fetch(url, { ...init, headers });
    },
  },
});`,
        },
        clientSetup: {
          code: `const client = new Client({
  name: "mcpx-client",
  version: "1.0.0"
});

await client.connect(transport);`,
        },
      }),
    },
  ];
};
