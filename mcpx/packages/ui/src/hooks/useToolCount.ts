import { useMemo } from "react";
import { useAccessControlsStore, useSocketStore } from "@/store";
import {
  type AgentForTools,
  getAvailableToolsForAgent,
  getTotalConnectedTools,
} from "./toolCount";

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
  const toolGroups = useAccessControlsStore((s) => s.toolGroups);
  const appConfig = useSocketStore((s) => s.appConfig);
  const connectedClients = useSocketStore(
    (s) => s.systemState?.connectedClients ?? [],
  );
  const targetServers = useSocketStore((s) => s.systemState?.targetServers);

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
    return getAvailableToolsForAgent({
      agent: options.agent,
      connectedClients,
      consumersConfig: appConfig?.permissions?.consumers,
      toolGroups,
      totalConnectedTools,
    });
  }, [
    options?.agent,
    connectedClients,
    appConfig?.permissions?.consumers,
    toolGroups,
    totalConnectedTools,
  ]);

  return { totalConnectedTools, availableTools };
}
