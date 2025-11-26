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
  const profiles = useAccessControlsStore((state) => state.profiles);
  const connectedClients = useSocketStore(
    (state) => state.systemState?.connectedClients ?? [],
  );

  const connectedTools = useMemo(
    () => servers.reduce((total, server) => total + server.tools.length, 0),
    [servers],
  );

  // Map agent names (consumer tags) to their profiles for O(1) lookup
  const profileByAgentMap = useMemo(() => {
    const map = new Map<string, typeof profiles[0]>();
    profiles.forEach((profile) => {
      if (profile.name !== "default") {
        profile.agents?.forEach((agent) => {
          map.set(agent.toLowerCase(), profile);
        });
      }
    });
    return map;
  }, [profiles]);

  // Map tool group IDs to tool groups for O(1) lookup
  const toolGroupByIdMap = useMemo(() => {
    const map = new Map<string, typeof toolGroups[0]>();
    toolGroups.forEach((group) => {
      map.set(group.id, group);
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

    try {
      const assignedToolGroupIds = new Set<string>();

      // Collect all tool groups assigned to connected agents
      for (const agent of connectedAgents) {
        // Get consumer tags for this agent's sessions
        const agentConsumerTags: string[] = [];
        for (const sessionId of agent.sessionIds) {
          const consumerTag = sessionIdToConsumerTagMap.get(sessionId);
          if (consumerTag) {
            agentConsumerTags.push(consumerTag);
          }
        }

        if (agentConsumerTags.length === 0) continue;

        // Find profile(s) for this agent's consumer tags
        // An agent can have multiple consumer tags, so we check all of them
        const foundProfiles = new Set<typeof profiles[0]>();
        for (const tag of agentConsumerTags) {
          const profile = profileByAgentMap.get(tag.toLowerCase());
          if (profile) {
            foundProfiles.add(profile);
          }
        }

        // Collect tool groups from all matching profiles
        for (const profile of foundProfiles) {
          if (profile.toolGroups?.length) {
            profile.toolGroups.forEach((toolGroupId) =>
              assignedToolGroupIds.add(toolGroupId),
            );
          }
        }
      }

      // If no tool groups assigned, show all connected tools (same as no agents)
      if (assignedToolGroupIds.size === 0) {
        return connectedTools;
      }

      // Collect all unique tools from assigned tool groups
      const uniqueTools = new Set<string>();
      for (const toolGroupId of assignedToolGroupIds) {
        const group = toolGroupByIdMap.get(toolGroupId);
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
    profileByAgentMap,
    toolGroupByIdMap,
    sessionIdToConsumerTagMap,
  ]);

  return useMemo(
    () => `${availableTools}/${connectedTools}`,
    [availableTools, connectedTools],
  );
};

