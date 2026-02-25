import { EditServerModal } from "@/components/dashboard/EditServerModal";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { ConnectivityDiagram } from "@/components/dashboard/SystemConnectivity/ConnectivityDiagram";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

import { useDashboardStore, useModalsStore, useSocketStore } from "@/store";
import { Agent, McpServer } from "@/types";
import { isActive } from "@/utils";
import { serversEqual } from "@/utils/server-comparison";
import { transformConfigurationData } from "@/utils/transform-system-state";
import { SystemState } from "@mcpx/shared-model";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

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
          navigate("/dashboard", { replace: true });
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
  }, [configurationData]);

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

    const serversChanged = !serversEqual(prev.servers, processedData.servers);

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

  return (
    <div className="p-4 md:p-6 bg-gray-100 text-[var(--color-text-primary)] flex flex-col  max-h-screen">
      <div className="flex flex-col flex-grow overflow-hidden">
        {/* Metrics Panel */}
        <MetricsPanel
          agents={aiAgents}
          servers={mcpServers}
          systemUsage={processedData.systemUsage}
        />
        <Card
          className={
            "shadow-sm border-[var(--color-border-primary)] bg-white flex flex-col overflow-hidden" +
            (isDiagramExpanded ? "  rounded-md" : " flex-0 h-[50px]")
          }
        >
          <CardContent className="p-0  overflow-hidden">
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
              />
            )}
          </CardContent>
        </Card>
      </div>
      {isEditServerModalOpen && (
        <EditServerModal
          isOpen={isEditServerModalOpen}
          onClose={closeEditServerModal}
        />
      )}
    </div>
  );
}
