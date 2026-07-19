import type { Agent, McpServer, McpServerStatus } from "@/types";
import { clusterDisplayName } from "@/types";
import { isActive } from "@/utils";
import type {
  ConnectedClient,
  ConnectionState,
  SystemState,
  TargetServer,
} from "@mcpx/shared-model";

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
    prompts: (server.prompts ?? []).map((prompt) => ({
      description: prompt.description || "",
      invocations: prompt.usage.callCount,
      lastCalledAt: prompt.usage.lastCalledAt,
      name: prompt.name,
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

export type TransformedState = {
  agents: Agent[];
  lastUpdated?: Date;
  servers: McpServer[];
  systemUsage?: {
    callCount: number;
    lastCalledAt?: Date;
  };
};

// Default access config: allow every tool on every server.
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

// The cluster's healthiest session (connected > unresponsive > disconnected),
// most recent within a tier. One live session keeps the agent connected. Shared
// so the node and the details modal never disagree.
export function pickRepresentativeClient(
  sessionIds: string[],
  connectedClients: ConnectedClient[],
): ConnectedClient | undefined {
  const clientsBySessionId = new Map(
    connectedClients.map((c) => [c.sessionId, c]),
  );
  // Newest session first, so `find` returns the most recent within a tier.
  const recentFirst = sessionIds
    .map((id) => clientsBySessionId.get(id))
    .filter((c): c is ConnectedClient => c != null)
    .reverse();
  const mostRecentWithState = (state: ConnectionState) =>
    recentFirst.find((c) => c.connectionState === state);
  return (
    mostRecentWithState("connected") ??
    mostRecentWithState("unresponsive") ??
    mostRecentWithState("disconnected")
  );
}

// Map system state to dashboard servers + agents. Live fields come from the
// cluster's healthiest session, so one live session keeps the agent connected.
export const transformConfigurationData = (
  config: SystemState,
): TransformedState => {
  const transformedServers = mapTargetServersToMcpServers(config.targetServers);
  const defaultAccessConfig = createDefaultAccessConfig(transformedServers);

  const transformedAgents: Agent[] = (config.connectedClientClusters || []).map(
    (cluster, index) => {
      const representative = pickRepresentativeClient(
        cluster.sessionIds,
        config.connectedClients,
      );

      const base = {
        id: `agent-cluster-${index}`,
        identifier:
          representative?.clientInfo?.name ?? clusterDisplayName(cluster),
        status: "connected",
        lastActivity: cluster.usage.lastCalledAt,
        sessionIds: cluster.sessionIds,
        llm: representative?.llm || {
          provider: "unknown",
          model: "unknown",
        },
        usage: cluster.usage,
        dynamicMode: representative?.dynamicMode ?? false,
        visibleTools: representative?.visibleTools ?? [],
        connectionState: representative?.connectionState ?? "connected",
        accessConfig: defaultAccessConfig,
      };
      switch (cluster.identityType) {
        case "consumerTag":
          return {
            ...base,
            identityType: "consumerTag",
            consumerTag: cluster.consumerTag,
            clientNames: cluster.clientNames,
          };
        case "clientName":
          return {
            ...base,
            identityType: "clientName",
            clientName: cluster.clientName,
          };
        case "anonymous":
          return { ...base, identityType: "anonymous" };
      }
    },
  );

  return {
    servers: transformedServers,
    agents: transformedAgents,
    systemUsage: config.usage,
    lastUpdated: config.lastUpdatedAt,
  };
};

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
