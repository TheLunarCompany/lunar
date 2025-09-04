import { EditServerModal } from "@/components/dashboard/EditServerModal";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { ConnectivityDiagram } from "@/components/dashboard/SystemConnectivity/ConnectivityDiagram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AddAgentModal } from "@/components/dashboard/SystemConnectivity/nodes/AddAgentModal";
import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { useDashboardStore, useModalsStore, useSocketStore } from "@/store";
import { Agent, McpServer, McpServerStatus } from "@/types";
import { isActive } from "@/utils";
import { SystemState } from "@mcpx/shared-model";
import { Maximize2, Minimize2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  const { configurationData, serializedAppConfig } = useSocketStore((s) => ({
    configurationData: s.systemState,
    serializedAppConfig: s.serializedAppConfig,
  }));
  const { closeEditServerModal, isEditServerModalOpen } = useModalsStore(
    (s) => ({
      closeAddServerModal: s.closeAddServerModal,
      closeEditServerModal: s.closeEditServerModal,
      isAddServerModalOpen: s.isAddServerModalOpen,
      isEditServerModalOpen: s.isEditServerModalOpen,
    }),
  );
  const [mcpServers, setMcpServers] = useState<Array<McpServer>>([]);
  const [aiAgents, setAiAgents] = useState<Agent[]>([]);
  const [mcpxSystemActualStatus, setMcpxSystemActualStatus] =
    useState("stopped");
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);

  const { isDiagramExpanded, reset, toggleDiagramExpansion } =
    useDashboardStore((s) => ({
      isDiagramExpanded: s.isDiagramExpanded,
      reset: s.reset,
      toggleDiagramExpansion: s.toggleDiagramExpansion,
    }));

  // Reset the state when the dashboard unmounts
  useEffect(() => reset, [reset]);

  // Memoized data processing to prevent unnecessary re-renders
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

  // Update state only when processed data changes
  useEffect(() => {
    setMcpServers(processedData.servers);
    setAiAgents(processedData.agents);
    setMcpxSystemActualStatus(processedData.status);
  }, [processedData]);

  // Reset state when no configuration data
  useEffect(() => {
    if (!configurationData) {
      setMcpServers([]);
      setAiAgents([]);
    }
  }, [configurationData]);

  return (
    <div className="p-4 md:p-6 bg-gray-100 text-[var(--color-text-primary)] flex flex-col h-screen max-h-screen">
      <div className="flex flex-col flex-grow space-y-4 overflow-hidden">
        {/* Metrics Panel */}
        <MetricsPanel
          agents={aiAgents}
          servers={mcpServers}
          systemUsage={processedData.systemUsage}
        />
        <Card
          className={
            "flex-1 shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] flex flex-col overflow-hidden" +
            (isDiagramExpanded ? " h-full rounded-md" : " flex-0 h-[50px]")
          }
        >
          <CardHeader className="flex-shrink-0 border-b border-[var(--color-border-primary)] py-2 px-3 md:py-3 md:px-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm md:text-base font-bold text-[var(--color-text-primary)]">
                System Connectivity
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddAgentModalOpen(true)}
                  className="h-7 px-3 text-xs border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Agent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddServerModalOpen(true)}
                  className="h-7 px-3 text-xs border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Server
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-grow overflow-hidden">
            {isDiagramExpanded && (
              <ConnectivityDiagram
                agents={aiAgents}
                mcpServersData={mcpServers}
                mcpxStatus={mcpxSystemActualStatus}
                version={serializedAppConfig?.version}
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
      {isAddAgentModalOpen && (
        <AddAgentModal
          isOpen={isAddAgentModalOpen}
          onClose={() => setIsAddAgentModalOpen(false)}
        />
      )}
      {isAddServerModalOpen && (
        <AddServerModal
          onClose={() => setIsAddServerModalOpen(false)}
          onServerAdded={() => {
            setIsAddServerModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
