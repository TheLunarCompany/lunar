import { EditServerModal } from "@/components/dashboard/EditServerModal";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { ConnectivityDiagram } from "@/components/dashboard/SystemConnectivity/ConnectivityDiagram";
import { HostedModeNotice } from "@/components/dashboard/SystemConnectivity/HostedModeNotice";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useInitialHostedMcpEditContext } from "@/data/use-initial-hosted-mode";

import { routes } from "@/routes";
import { useDashboardStore, useModalsStore, useSocketStore } from "@/store";
import { Agent, clusterDisplayName, McpServer } from "@/types";
import { ACTIVE_REQUEST_DURATION_MS, isActive } from "@/utils";
import { serversEqual } from "@/utils/server-comparison";
import { mapTargetServersToMcpServers } from "@/mapping/system-state";
import { SystemState } from "@mcpx/shared-model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type TransformedState = {
  agents: Agent[];
  lastUpdated?: Date;
  servers: McpServer[];
  systemUsage?: {
    callCount: number;
    lastCalledAt?: Date;
  };
};

// Helper function to create default access config for agents
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

const transformConfigurationData = (config: SystemState): TransformedState => {
  const transformedServers = mapTargetServersToMcpServers(config.targetServers);

  // Transform agents using clusters (backend always provides clusters now)
  const defaultAccessConfig = createDefaultAccessConfig(transformedServers);

  const transformedAgents: Agent[] = (config.connectedClientClusters || []).map(
    (cluster, index) => {
      const lastSessionId = cluster.sessionIds[cluster.sessionIds.length - 1];
      const clientForLastSession = config.connectedClients.find(
        (client) => client.sessionId === lastSessionId,
      );
      const base = {
        id: `agent-cluster-${index}`,
        identifier:
          clientForLastSession?.clientInfo?.name ?? clusterDisplayName(cluster),
        status: "connected",
        lastActivity: cluster.usage.lastCalledAt,
        sessionIds: cluster.sessionIds,
        llm: clientForLastSession?.llm || {
          provider: "unknown",
          model: "unknown",
        },
        usage: cluster.usage,
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

// TODO: Split this component into smaller pieces for better maintainability
export default function Dashboard() {
  // Use separate selectors to get stable references - Zustand will only re-render when these specific values change
  const configurationData = useSocketStore((s) => s.systemState);

  // Use individual selectors to prevent re-renders from object creation
  const closeEditServerModal = useModalsStore((s) => s.closeEditServerModal);
  const isEditServerModalOpen = useModalsStore((s) => s.isEditServerModalOpen);

  const [mcpServers, setMcpServers] = useState<Array<McpServer>>([]);
  const [aiAgents, setAiAgents] = useState<Agent[]>([]);
  const [mcpxSystemActualStatus, setMcpxSystemActualStatus] =
    useState("stopped");
  const [shouldOpenAddServerModal, setShouldOpenAddServerModal] =
    useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { dismiss } = useToast();
  const initialHostedMcpEditContext = useInitialHostedMcpEditContext();
  const isHostedMode = initialHostedMcpEditContext !== null;

  // Use individual selectors to prevent re-renders from object creation
  const isDiagramExpanded = useDashboardStore((s) => s.isDiagramExpanded);
  const optimisticallyRemovedServerName = useDashboardStore(
    (s) => s.optimisticallyRemovedServerName,
  );
  const setOptimisticallyRemovedServerName = useDashboardStore(
    (s) => s.setOptimisticallyRemovedServerName,
  );
  const reset = useDashboardStore((s) => s.reset);
  const toggleDiagramExpansion = useDashboardStore(
    (s) => s.toggleDiagramExpansion,
  );

  // Reset the state when the dashboard unmounts
  useEffect(() => reset, [reset]);

  const catalogHandledRef = useRef(false);
  const prevTabRef = useRef<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");

    if (tab === "catalog") {
      const tabChanged = prevTabRef.current !== "catalog";
      if (tabChanged) {
        catalogHandledRef.current = false;
      }

      if (!catalogHandledRef.current) {
        catalogHandledRef.current = true;
        dismiss();
        if (!isDiagramExpanded) {
          toggleDiagramExpansion();
        }
        setShouldOpenAddServerModal(true);
        const timer = setTimeout(() => {
          navigate(routes.dashboard, { replace: true });
          setTimeout(() => {
            setShouldOpenAddServerModal(false);
          }, 300);
        }, 100);
        prevTabRef.current = tab;
        return () => clearTimeout(timer);
      }
    } else {
      catalogHandledRef.current = false;
      if (shouldOpenAddServerModal) {
        setShouldOpenAddServerModal(false);
      }
    }
    prevTabRef.current = tab;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shouldOpenAddServerModal intentionally excluded to avoid loops
  }, [
    searchParams,
    dismiss,
    navigate,
    isDiagramExpanded,
    toggleDiagramExpansion,
  ]);

  // Periodic tick to re-evaluate time-dependent `isActive` checks so the
  // "running" animation starts/stops promptly without waiting for a new state push.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setTick((t) => t + 1),
      ACTIVE_REQUEST_DURATION_MS / 2,
    );
    return () => clearInterval(id);
  }, []);

  // Memoized data processing - recalculate when configurationData reference changes
  // The useEffect below will prevent state updates if data hasn't actually changed
  const processedData = useMemo(() => {
    if (!configurationData) {
      return {
        servers: [],
        agents: [],
        status: "stopped",
        systemUsage: undefined,
      };
    }

    const transformed = transformConfigurationData(configurationData);
    return {
      servers: transformed.servers,
      agents: transformed.agents,
      status: isActive(configurationData?.usage?.lastCalledAt)
        ? "running"
        : "stopped",
      systemUsage: transformed.systemUsage,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces periodic re-evaluation of isActive
  }, [configurationData, tick]);

  // Update state only when processed data actually changes (not just reference)
  const prevProcessedDataRef = useRef<typeof processedData | null>(null);
  useEffect(() => {
    // Only update if the actual data changed, not just the reference
    const prev = prevProcessedDataRef.current;
    if (!prev) {
      // First render - always update
      setMcpServers(processedData.servers);
      setAiAgents(processedData.agents);
      setMcpxSystemActualStatus(processedData.status);
      prevProcessedDataRef.current = processedData;
      return;
    }

    const serversChanged =
      !serversEqual(prev.servers, processedData.servers) ||
      prev.servers.some((s, i) => s.icon !== processedData.servers[i]?.icon);

    // Check if agents actually changed - compare by ID to handle order changes
    const prevAgentIds = new Set(prev.agents.map((a) => a.id));
    const newAgentIds = new Set(processedData.agents.map((a) => a.id));
    const agentsChanged =
      prev.agents.length !== processedData.agents.length ||
      prevAgentIds.size !== newAgentIds.size ||
      Array.from(prevAgentIds).some((id) => !newAgentIds.has(id)) ||
      prev.agents.some((a) => {
        const newAgent = processedData.agents.find((na) => na.id === a.id);
        return !newAgent || a.identifier !== newAgent.identifier;
      });

    // Check if status changed
    const statusChanged = prev.status !== processedData.status;

    if (serversChanged || agentsChanged || statusChanged) {
      setMcpServers(processedData.servers);
      setAiAgents(processedData.agents);
      setMcpxSystemActualStatus(processedData.status);
      prevProcessedDataRef.current = processedData;
    }
    // Clear optimistic removal once real data no longer has that server
    if (
      optimisticallyRemovedServerName &&
      !processedData.servers.some(
        (s) => s.name === optimisticallyRemovedServerName,
      )
    ) {
      setOptimisticallyRemovedServerName(null);
    }
  }, [
    processedData,
    optimisticallyRemovedServerName,
    setOptimisticallyRemovedServerName,
  ]);

  // Get MCPX version from system state
  const mcpxVersionString = (configurationData as SystemState)?.mcpxVersion;
  const parseVersion = (versionStr: string) => {
    if (!versionStr) return "1.0.0";
    const cleanVersion = versionStr.replace(/^v/, "");
    const versionPart = cleanVersion.split("-")[0];
    return versionPart;
  };
  const mcpxVersion = mcpxVersionString
    ? parseVersion(mcpxVersionString)
    : "1.0.0";
  // Reset state when no configuration data
  useEffect(() => {
    if (!configurationData) {
      setMcpServers([]);
      setAiAgents([]);
    }
  }, [configurationData]);

  const handleEditSuccess = useCallback((serverName: string) => {
    setMcpServers((prev) =>
      prev.map((s) => (s.name === serverName ? { ...s } : s)),
    );
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white p-4 text-foreground md:p-6">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Metrics Panel */}
        <MetricsPanel
          agents={aiAgents}
          servers={mcpServers}
          systemUsage={processedData.systemUsage}
        />
        {isHostedMode && (
          <div className="mb-4">
            <HostedModeNotice
              returnUrl={initialHostedMcpEditContext.returnUrl}
            />
          </div>
        )}
        <Card
          className={
            "py-0 border-0 ring-0 shadow-none bg-white flex min-h-0 flex-col" +
            " overflow-hidden" +
            (isDiagramExpanded ? " flex-1 rounded-md" : " flex-0 h-[50px]")
          }
        >
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {isDiagramExpanded && (
              <ConnectivityDiagram
                agents={aiAgents}
                mcpServersData={
                  optimisticallyRemovedServerName
                    ? mcpServers.filter(
                        (s) => s.name !== optimisticallyRemovedServerName,
                      )
                    : mcpServers
                }
                mcpxStatus={mcpxSystemActualStatus}
                version={mcpxVersion}
                initialOpenAddServerModal={shouldOpenAddServerModal}
                hostedMode={isHostedMode}
              />
            )}
          </CardContent>
        </Card>
      </div>
      {isEditServerModalOpen && (
        <EditServerModal
          isOpen={isEditServerModalOpen}
          onClose={closeEditServerModal}
          onEditSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
