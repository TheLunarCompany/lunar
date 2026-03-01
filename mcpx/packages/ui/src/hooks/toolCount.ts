/** Server shape with name and tools (e.g. from system state targetServers or McpServer[]) */
type ServerWithTools = { name: string; tools?: unknown[] }[] | null | undefined;

/** Inactive flags per server name (e.g. appConfig.targetServerAttributes) */
type TargetServerAttributes =
  | Record<string, { inactive?: boolean }>
  | null
  | undefined;

/** Tool group shape with services (e.g. from access-controls toolGroups) */
type ToolGroupForCount = {
  id: string;
  name: string;
  services?: Record<string, string[]>;
};

/** Consumer config shape from appConfig.permissions.consumers (minimal for tool counting) */
type ConsumersConfigForTools =
  | Record<string, { _type?: string; block?: unknown[]; allow?: string[] }>
  | undefined
  | null;

/** Connected client with sessionId and optional consumerTag */
type ConnectedClientForTools = {
  sessionId: string;
  consumerTag?: string | null;
};

/** Agent shape with sessionIds (for agent node / tool count) */
export type AgentForTools = { sessionIds: string[]; status?: string };

type ConsumerToolsResult =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "groups"; groupNames: string[] };

type ConsumerConfigEntry = {
  _type?: string;
  block?: unknown[];
  allow?: string[];
};

function interpretConsumerConfig(
  config: ConsumerConfigEntry | undefined | null,
): ConsumerToolsResult {
  if (!config) return { kind: "all" };
  if (
    config._type === "default-allow" &&
    "block" in config &&
    Array.isArray(config.block) &&
    config.block.length === 0
  ) {
    return { kind: "all" };
  }
  if (
    config._type === "default-block" &&
    "allow" in config &&
    Array.isArray(config.allow) &&
    config.allow.length === 0
  ) {
    return { kind: "none" };
  }
  if (
    "allow" in config &&
    Array.isArray(config.allow) &&
    config.allow.length > 0
  ) {
    return { kind: "groups", groupNames: config.allow };
  }
  return { kind: "all" };
}

/**
 * Total number of tools across connected target servers.
 * Excludes tools from servers marked inactive in targetServerAttributes.
 */
export function getTotalConnectedTools(
  targetServers: ServerWithTools,
  targetServerAttributes?: TargetServerAttributes,
): number {
  if (!targetServers?.length) return 0;
  return targetServers.reduce((total, server) => {
    const isInactive = targetServerAttributes?.[server.name]?.inactive === true;
    if (isInactive) return total;
    return total + (server.tools?.length ?? 0);
  }, 0);
}

/**
 * Available tools count for a single agent (e.g. agent node badge).
 * Uses appConfig.permissions.consumers: default-allow/default-block and allow arrays.
 */
export function getAvailableToolsForAgent(params: {
  agent: AgentForTools;
  connectedClients: ConnectedClientForTools[];
  consumersConfig: ConsumersConfigForTools;
  toolGroups: ToolGroupForCount[];
  totalConnectedTools: number;
}): number {
  const {
    agent,
    connectedClients,
    consumersConfig,
    toolGroups,
    totalConnectedTools,
  } = params;

  if (!consumersConfig) return totalConnectedTools;

  const sessionIdToConsumerTag = new Map<string, string>();
  connectedClients.forEach((client) => {
    if (client.sessionId && client.consumerTag) {
      sessionIdToConsumerTag.set(client.sessionId, client.consumerTag);
    }
  });

  const agentConsumerTags: string[] = [];
  for (const sessionId of agent.sessionIds) {
    const tag = sessionIdToConsumerTag.get(sessionId);
    if (tag) agentConsumerTags.push(tag);
  }
  if (agentConsumerTags.length === 0) return totalConnectedTools;

  const toolGroupByName = new Map<string, ToolGroupForCount>();
  toolGroups.forEach((g) => toolGroupByName.set(g.name, g));

  try {
    const assignedToolGroupNames = new Set<string>();
    let hasAllTools = false;
    let hasEmptyAllow = false;
    let hasToolGroups = false;

    for (const consumerTag of agentConsumerTags) {
      const result = interpretConsumerConfig(consumersConfig[consumerTag]);
      if (result.kind === "all") {
        hasAllTools = true;
        break;
      }
      if (result.kind === "none") {
        hasEmptyAllow = true;
        continue;
      }
      result.groupNames.forEach((name) => assignedToolGroupNames.add(name));
      hasToolGroups = true;
    }

    if (hasAllTools) return totalConnectedTools;
    if (assignedToolGroupNames.size === 0) {
      return hasEmptyAllow && !hasToolGroups ? 0 : totalConnectedTools;
    }

    const uniqueTools = new Set<string>();
    for (const groupName of assignedToolGroupNames) {
      const group = toolGroupByName.get(groupName);
      if (!group?.services) continue;
      for (const tools of Object.values(group.services)) {
        if (Array.isArray(tools)) tools.forEach((t) => uniqueTools.add(t));
      }
    }
    return uniqueTools.size;
  } catch {
    return totalConnectedTools;
  }
}
