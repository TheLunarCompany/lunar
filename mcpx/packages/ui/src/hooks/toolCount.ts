import {
  scopeSubjectKey,
  type ConsumerConfig,
  type EnabledSkills,
  type Skill,
} from "@mcpx/shared-model";
import { AgentRef } from "@/store";

/** Server shape with name and tools (e.g. from system state targetServers or McpServer[]) */
type ServerWithTools =
  | { name: string; catalogItemId?: string; tools?: unknown[] }[]
  | null
  | undefined;

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
export type PermissionEntriesByName =
  | Record<string, ConsumerConfig>
  | undefined
  | null;

/** Connected client with sessionId and optional consumerTag */
type ConnectedClientForTools = {
  sessionId: string;
  consumerTag?: string | null;
};

/** Agent shape with sessionIds (for agent node / tool count). identifier used when session does not send consumerTag (e.g. VS Code). */
export type AgentForTools = {
  sessionIds: string[];
  status?: string;
  /** Fallback for consumer config lookup when session.consumerTag is null */
  identifier?: string;
};

type ConsumerToolAccess =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "groups"; groupNames: string[] };

export function getConsumerToolAccess(
  config?: ConsumerConfig,
): ConsumerToolAccess {
  if (!config) return { kind: "all" };
  if (config._type === "default-allow") {
    return { kind: "all" }; // intentional
  }
  return config.allow.length > 0
    ? { kind: "groups", groupNames: config.allow }
    : { kind: "none" };
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
 * Uses appConfig.permissions.consumers and appConfig.permissions.clientNames: default-allow/default-block and allow arrays.
 * Only counts tools from servers that exist in targetServers and are not inactive.
 */
export function getAvailableToolsForAgent(params: {
  agent: AgentForTools;
  connectedClients: ConnectedClientForTools[];
  toolGroups: ToolGroupForCount[];
  totalConnectedTools: number;
  consumersConfig?: PermissionEntriesByName;
  clientsConfig?: PermissionEntriesByName;
  targetServers?: ServerWithTools;
  targetServerAttributes?: TargetServerAttributes;
}): number {
  const {
    agent,
    connectedClients,
    consumersConfig,
    clientsConfig,
    toolGroups,
    totalConnectedTools,
    targetServers,
    targetServerAttributes,
  } = params;

  if (!consumersConfig && !clientsConfig) return totalConnectedTools;

  const sessionIdToConsumerTag = new Map<string, string>();
  connectedClients.forEach((client) => {
    if (client.sessionId && client.consumerTag) {
      sessionIdToConsumerTag.set(client.sessionId, client.consumerTag);
    }
  });

  const agentRefs: AgentRef[] = [];
  for (const sessionId of agent.sessionIds) {
    const tag = sessionIdToConsumerTag.get(sessionId);
    if (tag) {
      agentRefs.push({ name: tag, identityType: "consumers" });
    } else if (agent.identifier) {
      // When session does not send consumerTag (e.g. VS Code), use agent identifier for config lookup
      agentRefs.push({ name: agent.identifier, identityType: "clientNames" });
    }
  }

  if (agentRefs.length === 0) return totalConnectedTools;

  const toolGroupByName = new Map<string, ToolGroupForCount>();
  toolGroups.forEach((g) => toolGroupByName.set(g.name, g));

  try {
    const assignedToolGroupNames = new Set<string>();
    let hasAllTools = false;
    let hasEmptyAllow = false;
    let hasToolGroups = false;

    for (const ref of agentRefs) {
      const config =
        ref.identityType === "consumers"
          ? consumersConfig?.[ref.name]
          : clientsConfig?.[ref.name];
      const consumerToolAccess = getConsumerToolAccess(config);

      if (consumerToolAccess.kind === "all") {
        hasAllTools = true;
        break;
      }
      if (consumerToolAccess.kind === "none") {
        hasEmptyAllow = true;
        continue;
      }
      consumerToolAccess.groupNames.forEach((name) =>
        assignedToolGroupNames.add(name),
      );
      hasToolGroups = true;
    }

    if (hasAllTools) return totalConnectedTools;
    if (assignedToolGroupNames.size === 0) {
      return hasEmptyAllow && !hasToolGroups ? 0 : totalConnectedTools;
    }

    const activeServerNames = new Set<string>();
    if (targetServers?.length) {
      targetServers.forEach((server) => {
        const isInactive =
          targetServerAttributes?.[server.name]?.inactive === true;
        if (!isInactive) activeServerNames.add(server.name);
      });
    }

    const uniqueTools = new Set<string>();
    for (const groupName of assignedToolGroupNames) {
      const group = toolGroupByName.get(groupName);
      if (!group?.services) continue;
      for (const [serverName, tools] of Object.entries(group.services)) {
        if (!activeServerNames.has(serverName)) continue;
        if (Array.isArray(tools)) tools.forEach((t) => uniqueTools.add(t));
      }
    }
    return uniqueTools.size;
  } catch {
    return totalConnectedTools;
  }
}

/**
 * Counts the union of tools exposed by skills assigned to an agent.
 * Agents with no assigned skills keep the default allow-all behavior.
 * Explicit selections are counted only for connected, active servers; wildcard
 * selections resolve against the matching connected server's current tools.
 */
export function getSkillToolsForAgent(params: {
  agent: AgentForTools;
  connectedClients: ConnectedClientForTools[];
  skills: Skill[];
  enabled: EnabledSkills[];
  targetServers: ServerWithTools;
  targetServerAttributes?: TargetServerAttributes;
}): number {
  const {
    agent,
    connectedClients,
    skills,
    enabled,
    targetServers,
    targetServerAttributes,
  } = params;
  const consumerTagBySessionId = new Map(
    connectedClients.flatMap((client) =>
      client.sessionId && client.consumerTag
        ? [[client.sessionId, client.consumerTag] as const]
        : [],
    ),
  );
  const subjectKeys = new Set<string>();

  for (const sessionId of agent.sessionIds) {
    const consumerTag = consumerTagBySessionId.get(sessionId);
    if (consumerTag) {
      subjectKeys.add(
        scopeSubjectKey({ kind: "consumerTag", value: consumerTag }),
      );
    } else if (agent.identifier) {
      subjectKeys.add(
        scopeSubjectKey({ kind: "clientName", value: agent.identifier }),
      );
    }
  }

  const totalConnectedTools = getTotalConnectedTools(
    targetServers,
    targetServerAttributes,
  );
  if (subjectKeys.size === 0) return totalConnectedTools;

  const assignedSkillIds = new Set(
    enabled
      .filter((entry) => subjectKeys.has(scopeSubjectKey(entry.subject)))
      .flatMap((entry) => entry.skillIds),
  );
  if (assignedSkillIds.size === 0) return totalConnectedTools;

  const activeServerByCatalogItemId = new Map(
    (targetServers ?? []).flatMap((server) => {
      if (
        !server.catalogItemId ||
        targetServerAttributes?.[server.name]?.inactive === true
      ) {
        return [];
      }
      return [[server.catalogItemId, server] as const];
    }),
  );
  const uniqueToolNames = new Set<string>();

  for (const skill of skills) {
    if (!assignedSkillIds.has(skill.id)) continue;

    for (const item of skill.capabilityGroup?.items ?? []) {
      const server = activeServerByCatalogItemId.get(item.catalogItemId);
      if (!server) continue;

      if (item.tools === "*") {
        for (const tool of server.tools ?? []) {
          const name = getToolName(tool);
          if (name) uniqueToolNames.add(name);
        }
      } else {
        item.tools.forEach((name) => uniqueToolNames.add(name));
      }
    }
  }

  return uniqueToolNames.size;
}

function getToolName(tool: unknown): string | null {
  if (typeof tool === "string") return tool;
  if (
    typeof tool === "object" &&
    tool !== null &&
    "name" in tool &&
    typeof tool.name === "string"
  ) {
    return tool.name;
  }
  return null;
}
