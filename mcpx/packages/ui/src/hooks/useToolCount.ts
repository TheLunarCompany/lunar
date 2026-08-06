import { useMemo } from "react";
import { useAccessControlsStore, useSocketStore } from "@/store";
import {
  type AgentForTools,
  getAvailableToolsForAgent,
  getSkillToolsForAgent,
  getTotalConnectedTools,
} from "./toolCount";
import { isSkillsPageEnabled } from "@/config/runtime-config";
import { useEnabledSkills, useSkills } from "@/data/skills";

export interface UseToolCountOptions {
  /** When set, returned availableTools is the count for this agent only (e.g. agent node badge). */
  agent?: AgentForTools;
}

/**
 * Hook that returns total connected tools (excluding inactive servers) and,
 * when agent is passed, available tools for that agent (permissions / tool groups).
 * Reads toolGroups, appConfig, connectedClients, targetServers from stores.
 */
export function useToolCount(options?: UseToolCountOptions) {
  const skillsPageEnabled = isSkillsPageEnabled();
  const toolGroups = useAccessControlsStore((s) => s.toolGroups);
  const appConfig = useSocketStore((s) => s.appConfig);
  const connectedClients = useSocketStore(
    (s) => s.systemState?.connectedClients ?? [],
  );
  const targetServers = useSocketStore((s) => s.systemState?.targetServers);
  const skillsQuery = useSkills({
    enabled: skillsPageEnabled && options?.agent != null,
  });
  const enabledSkillsQuery = useEnabledSkills({
    enabled: skillsPageEnabled && options?.agent != null,
  });

  const totalConnectedTools = useMemo(
    () =>
      getTotalConnectedTools(
        targetServers ?? [],
        appConfig?.targetServerAttributes,
      ),
    [targetServers, appConfig?.targetServerAttributes],
  );

  const availableTools = useMemo(() => {
    if (options?.agent == null) return totalConnectedTools;

    if (!skillsPageEnabled) {
      return getAvailableToolsForAgent({
        agent: options.agent,
        connectedClients,
        consumersConfig: appConfig?.permissions?.consumers,
        clientsConfig: appConfig?.permissions?.clientNames,
        toolGroups,
        totalConnectedTools,
        targetServers: targetServers ?? undefined,
        targetServerAttributes: appConfig?.targetServerAttributes,
      });
    }

    // Skills list still loading; show the full connected count until defined.
    if (skillsQuery.data == null) {
      return totalConnectedTools;
    }

    return getSkillToolsForAgent({
      agent: options.agent,
      connectedClients,
      skills: skillsQuery.data,
      enabled: enabledSkillsQuery.data ?? appConfig?.skills?.enabled ?? [],
      targetServers: targetServers ?? undefined,
      targetServerAttributes: appConfig?.targetServerAttributes,
    });
  }, [
    options?.agent,
    connectedClients,
    appConfig?.permissions?.consumers,
    appConfig?.permissions?.clientNames,
    appConfig?.skills?.enabled,
    appConfig?.targetServerAttributes,
    skillsPageEnabled,
    enabledSkillsQuery.data,
    skillsQuery.data,
    toolGroups,
    totalConnectedTools,
    targetServers,
  ]);

  return { totalConnectedTools, availableTools };
}
