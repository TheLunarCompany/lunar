import { Agent, McpServer, McpServerStatus } from "@/types";
import { isActive } from "@/utils";
import { SystemState } from "@mcpx/shared-model";

export type TransformedState = {
  agents: Agent[];
  lastUpdated?: Date;
  servers: McpServer[];
  systemUsage?: {
    callCount: number;
    lastCalledAt?: Date;
  };
};

const createDefaultAccessConfig = (servers: McpServer[]) => {
  return servers.map((server) => ({
    serverId: server.id,
    serverName: server.name,
    allowServer: true,
    tools: server.tools.map((tool) => ({
      toolName: tool.name,
      allowTool: true,
    })),
  }));
};

export const transformConfigurationData = (
  config: SystemState,
): TransformedState => {
  const transformedServers: McpServer[] = (config.targetServers || []).map(
    (server) => {
      let status: McpServerStatus = "connected_stopped";
      let connectionError = null;
      let missingEnvVars = undefined;

      switch (server.state.type) {
        case "connecting":
          status = "connecting";
          break;
        case "connected":
          status = isActive(server.usage?.lastCalledAt)
            ? "connected_running"
            : "connected_stopped";
          break;
        case "connection-failed":
          status = "connection_failed";
          connectionError =
            server.state.error?.name === "McpError"
              ? "Failed to initiate server: inspect logs for more details"
              : server.state.error?.message || "Connection failed";
          break;
        case "pending-auth":
          status = "pending_auth";
          break;
        case "pending-input":
          status = "pending_input";
          missingEnvVars = server.state.missingEnvVars;
          break;
        default:
          status = "connected_stopped";
      }

      return {
        args: (server._type === "stdio" && server.args) || [],
        command: (server._type === "stdio" && server.command) || "",
        env: (server._type === "stdio" && server.env) || {},
        icon: server.icon,
        id: `server-${server.name}`,
        name: server.name,
        status,
        connectionError,
        missingEnvVars,
        tools: server.tools.map((tool) => ({
          name: tool.name,
          description: tool.description || "",
          invocations: tool.usage.callCount,
          lastCalledAt: tool.usage.lastCalledAt,
        })),
        configuration: {},
        usage: server.usage,
        type: server._type || "stdio",
        url: ("url" in server && server.url) || "",
        headers: ("headers" in server && server.headers) || {},
      };
    },
  );

  const defaultAccessConfig = createDefaultAccessConfig(transformedServers);

  const transformedAgents: Agent[] = (config.connectedClientClusters || []).map(
    (cluster, index) => {
      const firstClient = config.connectedClients.find((client) =>
        cluster.sessionIds.includes(client.sessionId),
      );

      return {
        id: `agent-cluster-${index}`,
        identifier: cluster.name,
        status: "connected",
        lastActivity: cluster.usage.lastCalledAt,
        sessionIds: cluster.sessionIds,
        llm: firstClient?.llm || { provider: "unknown", model: "unknown" },
        usage: cluster.usage,
        accessConfig: defaultAccessConfig,
      };
    },
  );

  return {
    servers: transformedServers,
    agents: transformedAgents,
    systemUsage: config.usage,
    lastUpdated: config.lastUpdatedAt,
  };
};
