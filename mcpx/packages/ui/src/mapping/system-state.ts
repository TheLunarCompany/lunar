import type { McpServer, McpServerStatus } from "@/types";
import { isActive } from "@/utils";
import type { SystemState, TargetServer } from "@mcpx/shared-model";

function getTargetServerStatus(server: TargetServer): McpServerStatus {
  switch (server.state.type) {
    case "connecting":
      return "connecting";
    case "connected":
      return isActive(server.usage?.lastCalledAt)
        ? "connected_running"
        : "connected_stopped";
    case "connection-failed":
      return "connection_failed";
    case "pending-auth":
      return "pending_auth";
    case "pending-input":
      return "pending_input";
  }
}

function getTargetServerConnectionError(server: TargetServer): string | null {
  if (server.state.type !== "connection-failed") {
    return null;
  }

  return server.state.error?.name === "McpError"
    ? "Failed to initiate server: inspect logs for more details"
    : server.state.error?.message || "Connection failed";
}

export function mapTargetServerToMcpServer(server: TargetServer): McpServer {
  return {
    args: server._type === "stdio" ? (server.args ?? []) : [],
    catalogItemId: server.catalogItemId,
    command: server._type === "stdio" ? server.command : "",
    connectionError: getTargetServerConnectionError(server),
    env: server._type === "stdio" ? (server.env ?? {}) : {},
    headers: "headers" in server ? (server.headers ?? {}) : {},
    icon: server.icon,
    id: `server-${server.name}`,
    missingEnvVars:
      server.state.type === "pending-input"
        ? server.state.missingEnvVars
        : undefined,
    name: server.name,
    status: getTargetServerStatus(server),
    tools: server.tools.map((tool) => ({
      description: tool.description || "",
      invocations: tool.usage.callCount,
      lastCalledAt: tool.usage.lastCalledAt,
      name: tool.name,
    })),
    configuration: {},
    usage: server.usage,
    type: server._type,
    url: "url" in server ? server.url : "",
  };
}

export function mapTargetServersToMcpServers(
  targetServers: SystemState["targetServers"] | null | undefined,
): McpServer[] {
  return (targetServers ?? []).map(mapTargetServerToMcpServer);
}

export function findMcpServerByName(
  systemState: SystemState | null,
  serverName: string | null | undefined,
): McpServer | null {
  if (!systemState || !serverName) {
    return null;
  }

  const targetServer = systemState.targetServers.find(
    (server) => server.name === serverName,
  );

  return targetServer ? mapTargetServerToMcpServer(targetServer) : null;
}
