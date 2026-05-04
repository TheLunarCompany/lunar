import type { TargetServer } from "@mcpx/shared-model";

import type { McpServer } from "@/types";

export function getEditTargetServer(server: McpServer): TargetServer {
  const baseServer = {
    name: server.name,
    icon: server.icon,
    state: { type: "connected" } as const,
    tools: server.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      usage: {
        callCount: tool.invocations,
        lastCalledAt: tool.lastCalledAt
          ? new Date(tool.lastCalledAt)
          : undefined,
      },
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    })),
    originalTools: server.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    })),
    usage: {
      callCount: server.usage.callCount,
      lastCalledAt: server.usage.lastCalledAt
        ? new Date(server.usage.lastCalledAt)
        : undefined,
    },
  };

  if (server.type === "stdio") {
    return {
      _type: "stdio",
      ...baseServer,
      command: server.command || "",
      args: server.args,
      env: server.env,
    };
  }

  if (server.type === "sse") {
    return {
      _type: "sse",
      ...baseServer,
      url: server.url || "",
      ...(server.headers && { headers: server.headers }),
    };
  }

  return {
    _type: "streamable-http",
    ...baseServer,
    url: server.url || "",
    ...(server.headers && { headers: server.headers }),
  };
}
