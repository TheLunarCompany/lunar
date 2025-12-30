import { EditServerModal } from "@/components/dashboard/EditServerModal";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { ConnectivityDiagram } from "@/components/dashboard/SystemConnectivity/ConnectivityDiagram";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

import { useDashboardStore, useModalsStore, useSocketStore } from "@/store";
import { Agent, McpServer, McpServerStatus } from "@/types";
import { isActive } from "@/utils";
import { SystemState } from "@mcpx/shared-model";
import { useEffect, useMemo, useRef, useState } from "react";
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

// Transform JSON configuration data to our internal format
// TODO: This should be moved to a separate utility file
const transformConfigurationData = (config: SystemState): TransformedState => {
  // Transform targetServers_new to mcpServers format - keep original order
  const transformedServers: McpServer[] = (config.targetServers_new || []).map(
    (server) => {
      // Determine status based on connection state
      let status: McpServerStatus = "connected_stopped";
      let connectionError = null;

      switch (server.state.type) {
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

  // Transform agents using clusters (backend always provides clusters now)
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

    // Check if servers actually changed - compare by ID to handle order changes
    const prevServerIds = new Set(prev.servers.map((s) => s.id));
    const newServerIds = new Set(processedData.servers.map((s) => s.id));
    const serversChanged =
      prev.servers.length !== processedData.servers.length ||
      prevServerIds.size !== newServerIds.size ||
      Array.from(prevServerIds).some((id) => !newServerIds.has(id)) ||
      prev.servers.some((s) => {
        const newServer = processedData.servers.find((ns) => ns.id === s.id);
        return (
          !newServer ||
          s.name !== newServer.name ||
          s.status !== newServer.status
        );
      });

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
  }, [processedData]);

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
                mcpServersData={mcpServers}
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
