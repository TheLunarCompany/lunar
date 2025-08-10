import { AgentsDetails } from "@/components/dashboard/AgentsDetails";
import { DEFAULT_SERVER_ICON } from "@/components/dashboard/constants";
import { EditServerModal } from "@/components/dashboard/EditServerModal";
import { McpServersDetails } from "@/components/dashboard/McpServersDetails";
import { McpxDetails } from "@/components/dashboard/McpxDetails";
import { ConnectivityDiagram } from "@/components/dashboard/SystemConnectivity/ConnectivityDiagram";
import { TabsToolbar } from "@/components/dashboard/TabsToolbar";
import { ToolsDetails } from "@/components/dashboard/ToolsDetails";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DashboardTabName,
  useDashboardStore,
  useModalsStore,
  useSocketStore,
} from "@/store";
import { isActive } from "@/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// Transform JSON configuration data to our internal format
// TODO: This should be moved to a separate utility file
const transformConfigurationData = (config) => {
  // Transform targetServers_new to mcpServers format - keep original order
  const transformedServers = (
    config.targetServers_new ||
    config.targetServers ||
    []
  ).map((server) => {
    // Determine status based on connection state
    let status = "connected_stopped";
    let connectionError = null;

    if (server.state) {
      // New format with connection states
      switch (server.state.type) {
        case "connected":
          status = isActive(server.usage?.lastCalledAt)
            ? "connected_running"
            : "connected_stopped";
          break;
        case "connection-failed":
          status = "connection_failed";
          connectionError = server.state.error?.message || "Connection failed";
          break;
        default:
          status = "connected_stopped";
      }
    } else {
      // Check for error in old format
      if (server.connectionError) {
        status = "connection_failed";
        connectionError = server.state.error?.message || "Connection failed";
      } else {
        status = isActive(server.usage?.lastCalledAt)
          ? "connected_running"
          : "connected_stopped";
      }
    }

    return {
      args: server.args,
      command: server.command,
      env: server.env,
      icon: server.icon || DEFAULT_SERVER_ICON,
      id: `server-${server.name}`,
      name: server.name,
      status,
      connectionError,
      tools: server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        invocations: tool.usage.callCount,
        lastCalledAt: tool.usage.lastCalledAt,
      })),
      configuration: {},
      usage: server.usage,
      type: server._type || "stdio",
      url: server.url || "",
    };
  });

  const transformedAgents = config.connectedClients.map((client, index) => {
    // Initialize accessConfig: by default, allow all servers and tools
    const defaultAccessConfig = transformedServers.map((server) => ({
      serverId: server.id,
      serverName: server.name,
      allowServer: true,
      tools: server.tools.map((tool) => ({
        toolName: tool.name,
        allowTool: true,
      })),
    }));

    return {
      id: `agent-${index}`,
      identifier: client.consumerTag || client.sessionId,
      status: "connected",
      lastActivity: client.usage.lastCalledAt,
      sessionId: client.sessionId,
      llm: client.llm || { provider: "unknown", model: "unknown" },
      usage: client.usage,
      accessConfig: defaultAccessConfig,
    };
  });

  return {
    servers: transformedServers,
    agents: transformedAgents,
    systemUsage: config.usage,
    lastUpdated: config.lastUpdatedAt,
  };
};

// TODO: Split this component into smaller pieces for better maintainability
export default function Dashboard() {
  const { configurationData } = useSocketStore((s) => ({
    configurationData: s.systemState,
  }));
  const { closeEditServerModal, isEditServerModalOpen } = useModalsStore(
    (s) => ({
      closeAddServerModal: s.closeAddServerModal,
      closeEditServerModal: s.closeEditServerModal,
      isAddServerModalOpen: s.isAddServerModalOpen,
      isEditServerModalOpen: s.isEditServerModalOpen,
    }),
  );
  const [mcpServers, setMcpServers] = useState(null);
  const [aiAgents, setAiAgents] = useState([]);
  const [mcpxSystemActualStatus, setMcpxSystemActualStatus] =
    useState("stopped");

  const {
    currentTab,
    isDiagramExpanded,
    reset,
    setCurrentTab,
    toggleDiagramExpansion,
  } = useDashboardStore((s) => ({
    currentTab: s.currentTab,
    isDiagramExpanded: s.isDiagramExpanded,
    reset: s.reset,
    setCurrentTab: s.setCurrentTab,
    toggleDiagramExpansion: s.toggleDiagramExpansion,
  }));

  // Reset the state when the dashboard unmounts
  useEffect(() => reset, [reset]);

  // Memoized data processing to prevent unnecessary re-renders
  const processedData = useMemo(() => {
    if (!configurationData) {
      return {
        servers: null,
        agents: [],
        status: "stopped",
      };
    }

    const transformed = transformConfigurationData(configurationData);
    return {
      servers: transformed.servers,
      agents: transformed.agents,
      status: isActive(configurationData?.usage?.lastCalledAt)
        ? "running"
        : "stopped",
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
      setMcpServers(null);
      setAiAgents([]);
      setCurrentTab(DashboardTabName.MCPX);
    }
  }, [configurationData, setCurrentTab]);

  const handleTabChange = useCallback(
    (value) => {
      setCurrentTab(value, {
        setSearch: {
          agents: "",
          servers: "",
        },
      });
    },
    [setCurrentTab],
  );

  return (
    <div className="p-4 md:p-6 bg-[var(--color-bg-app)] text-[var(--color-text-primary)] flex flex-col h-screen max-h-screen">
      <div className="flex flex-col flex-grow space-y-4 overflow-hidden">
        <Card
          className={
            "flex-1 shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] flex flex-col overflow-hidden" +
            (isDiagramExpanded
              ? " h-full max-h-[calc(50vh_-_1.5rem_-_8px)]"
              : " flex-0 h-[50px]")
          }
        >
          <CardHeader className="flex-shrink-0 border-b border-[var(--color-border-primary)] py-2 px-3 md:py-3 md:px-4">
            <div className="flex justify-between">
              <CardTitle className="text-sm md:text-base font-bold text-[var(--color-text-primary)]">
                System Connectivity
              </CardTitle>
              <Button
                variant="icon"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDiagramExpansion();
                }}
                className="text-[9px] px-1 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
              >
                {isDiagramExpanded ? (
                  <Minimize2 className="w-2 h-2 mr-0.5" />
                ) : (
                  <Maximize2 className="w-2 h-2 mr-0.5" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-grow overflow-hidden">
            {isDiagramExpanded && (
              <ConnectivityDiagram
                agents={aiAgents}
                mcpServersData={mcpServers}
                mcpxStatus={mcpxSystemActualStatus}
              />
            )}
          </CardContent>
        </Card>

        <Tabs
          activationMode="manual"
          onValueChange={handleTabChange}
          value={currentTab}
        >
          <Card className="flex-1 shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] flex flex-col overflow-hidden">
            <CardContent className="flex-grow p-0 overflow-hidden">
              <CardHeader className="border-b border-[var(--color-border-primary)] py-2 px-3 flex-shrink-0">
                <TabsToolbar />
              </CardHeader>
              <TabsContent
                value={DashboardTabName.Agents}
                className="m-0 w-full"
              >
                <AgentsDetails agents={aiAgents} />
              </TabsContent>
              <TabsContent value={DashboardTabName.MCPX} className="m-0 w-full">
                <McpxDetails agents={aiAgents} servers={mcpServers} />
              </TabsContent>
              <TabsContent
                value={DashboardTabName.Servers}
                className="m-0 w-full"
              >
                <McpServersDetails servers={mcpServers} />
              </TabsContent>
              <TabsContent
                value={DashboardTabName.Tools}
                className="m-0 w-full"
              >
                <ToolsDetails servers={mcpServers} />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
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
