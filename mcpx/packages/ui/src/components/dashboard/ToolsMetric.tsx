import { Agent, McpServer } from "@/types";
import { useAccessControlsStore, useSocketStore } from "@/store";
import { useMemo } from "react";

interface UseToolsMetricProps {
  agents: Agent[];
  servers: McpServer[];
}

/**
 * Custom hook to calculate the available tools metric.
 * Returns a string in the format "{availableTools}/{connectedTools}".
 * 
 * Available tools are calculated as the unique count of tools from tool groups
 * assigned to connected agents. If no agents are connected or no tool groups
 * are assigned, it returns the total connected tools count.
 */
export const useToolsMetric = ({ agents, servers }: UseToolsMetricProps) => {
  const toolGroups = useAccessControlsStore((state) => state.toolGroups);
  const appConfig = useSocketStore((state) => state.appConfig);
  const connectedClients = useSocketStore(
    (state) => state.systemState?.connectedClients ?? [],
  );

  const connectedTools = useMemo(
    () => servers.reduce((total, server) => total + server.tools.length, 0),
    [servers],
  );


  const toolGroupByNameMap = useMemo(() => {
    const map = new Map<string, typeof toolGroups[0]>();
    toolGroups.forEach((group) => {
      map.set(group.name, group);
    });
    return map;
  }, [toolGroups]);

  // Map session IDs to consumer tags for efficient lookup
  const sessionIdToConsumerTagMap = useMemo(() => {
    const map = new Map<string, string>();
    connectedClients.forEach((client) => {
      if (client.sessionId && client.consumerTag) {
        map.set(client.sessionId, client.consumerTag);
      }
    });
    return map;
  }, [connectedClients]);

  const availableTools = useMemo(() => {
    const connectedAgents = agents.filter(
      (agent) => agent.status === "connected",
    );

    // If no agents connected, show all connected tools
    if (connectedAgents.length === 0) {
      return connectedTools;
    }

    if (!appConfig?.permissions?.consumers) {
      return connectedTools;
    }

    try {
      const assignedToolGroupNames = new Set<string>();
      let hasAnyAgentWithAllTools = false;
      let allAgentsHaveEmptyAllow = true;

      // Single pass through agents to collect all information
      for (const agent of connectedAgents) {
        // Get consumer tags for this agent's sessions
        const agentConsumerTags: string[] = [];
        for (const sessionId of agent.sessionIds) {
          const consumerTag = sessionIdToConsumerTagMap.get(sessionId);
          if (consumerTag) {
            agentConsumerTags.push(consumerTag);
          }
        }

        if (agentConsumerTags.length === 0) {
          allAgentsHaveEmptyAllow = false;
          continue;
        }

        // Check each consumer tag's config
        let agentHasAllTools = false;
        let agentHasEmptyAllow = false;
        let agentHasToolGroups = false;

        for (const consumerTag of agentConsumerTags) {
          const consumerConfig = appConfig.permissions.consumers[consumerTag];
          
          // If no consumer config, agent has all tools (falls back to default)
          if (!consumerConfig) {
            agentHasAllTools = true;
            break;
          }

          // If _type is "default-allow" with empty block array, agent has all tools
          if (
            consumerConfig._type === "default-allow" &&
            "block" in consumerConfig &&
            Array.isArray(consumerConfig.block) &&
            consumerConfig.block.length === 0
          ) {
            agentHasAllTools = true;
            break;
          }

          // If _type is "default-block" and allow array is empty, agent has 0 tools
          if (
            consumerConfig._type === "default-block" &&
            "allow" in consumerConfig &&
            Array.isArray(consumerConfig.allow) &&
            consumerConfig.allow.length === 0
          ) {
            agentHasEmptyAllow = true;
            continue;
          }

          // Collect tool group names from allow array (default-block)
          if ("allow" in consumerConfig && Array.isArray(consumerConfig.allow) && consumerConfig.allow.length > 0) {
            consumerConfig.allow.forEach((groupName) =>
              assignedToolGroupNames.add(groupName),
            );
            agentHasToolGroups = true;
          }
        }

        if (agentHasAllTools) {
          hasAnyAgentWithAllTools = true;
        }
        if (!agentHasEmptyAllow || agentHasToolGroups) {
          allAgentsHaveEmptyAllow = false;
        }
      }

      // If any agent has all tools enabled, show all connected tools
      if (hasAnyAgentWithAllTools) {
        return connectedTools;
      }

      // If no tool groups assigned and all agents have empty allow arrays, return 0
      if (assignedToolGroupNames.size === 0) {
        return allAgentsHaveEmptyAllow ? 0 : connectedTools;
      }

      // Collect all unique tools from assigned tool groups
      const uniqueTools = new Set<string>();
      for (const groupName of assignedToolGroupNames) {
        const group = toolGroupByNameMap.get(groupName);
        if (!group?.services) continue;

        for (const tools of Object.values(group.services)) {
          if (Array.isArray(tools)) {
            for (const tool of tools) {
              uniqueTools.add(tool);
            }
          }
        }
      }

      return uniqueTools.size;
    } catch (error) {
      // Silently fallback to showing all connected tools on error
      // In production, you might want to log this error
      return connectedTools;
    }
  }, [
    agents,
    connectedTools,
    appConfig,
    toolGroupByNameMap,
    sessionIdToConsumerTagMap,
  ]);

  return useMemo(
    () => `${availableTools}/${connectedTools}`,
    [availableTools, connectedTools],
  );
};

