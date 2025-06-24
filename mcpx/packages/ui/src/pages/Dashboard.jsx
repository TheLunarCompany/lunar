import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { AgentsDetails } from "@/components/dashboard/AgentsDetails";
import { EditServerModal } from "@/components/dashboard/EditServerModal";
import { McpServersDetails } from "@/components/dashboard/McpServersDetails";
import { McpxDetails } from "@/components/dashboard/McpxDetails";
import { ConnectivityDiagram } from "@/components/dashboard/SystemConnectivity/ConnectivityDiagram";
import { TabsToolbar } from "@/components/dashboard/TabsToolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DashboardTabName,
  useDashboardStore,
  useModalsStore,
  useSocketStore,
} from "@/store";
import sortBy from "lodash/sortBy";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const isServerIdle = (lastCalledAt) => {
  if (!lastCalledAt) return true;
  const lastCall = new Date(lastCalledAt);
  const now = new Date();
  const diffInMinutes = (now - lastCall) / (1000 * 60);
  return diffInMinutes > 1;
};

// Transform JSON configuration data to our internal format
// TODO: This should be moved to a separate utility file
const transformConfigurationData = (config) => {
  // Transform targetServers to mcpServers format
  const transformedServers = sortBy(config.targetServers, "name").map(
    (server) => ({
      args: server.args || [],
      command: server.command,
      env: server.env || {},
      icon: server.icon,
      id: `server-${server.name}`,
      name: server.name,
      status: isServerIdle(server.usage.lastCalledAt)
        ? "connected_stopped"
        : "connected_running",
      tools: server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        invocations: tool.usage.callCount,
        lastCalledAt: tool.usage.lastCalledAt,
      })),
      configuration: {},
      usage: server.usage,
    }),
  );

  const transformedAgents = config.connectedClients.map((client, index) => {
    // Initialize access_config: by default, allow all servers and tools
    const defaultAccessConfig = transformedServers.map((server) => ({
      server_id: server.id,
      server_name: server.name,
      allow_server: true,
      tools: server.tools.map((tool) => ({
        tool_name: tool.name,
        allow_tool: true,
      })),
    }));

    return {
      id: `agent-${index}`,
      identifier: client.consumerTag || client.sessionId,
      status: "connected",
      last_activity: client.usage.lastCalledAt,
      sessionId: client.sessionId,
      llm: client.llm || { provider: "unknown", model: "unknown" },
      usage: client.usage,
      access_config: defaultAccessConfig,
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
  const {
    closeAddServerModal,
    closeEditServerModal,
    isAddServerModalOpen,
    isEditServerModalOpen,
    openAddServerModal,
  } = useModalsStore((s) => ({
    closeAddServerModal: s.closeAddServerModal,
    closeEditServerModal: s.closeEditServerModal,
    isAddServerModalOpen: s.isAddServerModalOpen,
    isEditServerModalOpen: s.isEditServerModalOpen,
    openAddServerModal: s.openAddServerModal,
  }));
  const [mcpServers, setMcpServers] = useState(null);
  const [aiAgents, setAiAgents] = useState([]);
  const [mcpxSystemActualStatus, setMcpxSystemActualStatus] =
    useState("stopped");

  const { currentTab, setCurrentTab, selectedId, setSelectedId } =
    useDashboardStore((s) => ({
      currentTab: s.currentTab,
      setCurrentTab: s.setCurrentTab,
      selectedId: s.selectedId,
      setSelectedId: s.setSelectedId,
    }));

  const selectedServer = useMemo(() => {
    return mcpServers?.find((server) => server.id === selectedId);
  }, [mcpServers, selectedId]);
  const selectedAgent = useMemo(() => {
    return aiAgents.find((agent) => agent.id === selectedId);
  }, [aiAgents, selectedId]);

  const processConfigurationData = (config) => {
    const transformed = transformConfigurationData(config);
    setMcpServers(() => transformed.servers);
    setAiAgents(() => transformed.agents);
    setMcpxSystemActualStatus(
      isServerIdle(config?.usage?.lastCalledAt) ? "stopped" : "running",
    );
  };

  useEffect(() => {
    if (configurationData) {
      processConfigurationData(configurationData);
    } else {
      setMcpServers(null);
      setAiAgents([]);
      setCurrentTab(DashboardTabName.MCPX);
    }
  }, [configurationData, setCurrentTab]);

  const handleAgentSelect = (agent) => {
    setSelectedId(agent.id);
    setCurrentTab(DashboardTabName.Agents);
  };

  const handleMcpServerSelect = (server) => {
    if (selectedId === server.id) {
      // If the same server is clicked again, do nothing
      return;
    }
    setSelectedId(server.id);
    setCurrentTab(DashboardTabName.Servers);
  };

  const handleMcpxSelect = () => {
    setSelectedId("mcpx");
    setCurrentTab(DashboardTabName.MCPX);
  };

  const handleSelectedServerDeleted = () => {
    setSelectedId(null);
    setCurrentTab(DashboardTabName.MCPX);
  };

  const handleTabChange = (value) => {
    setCurrentTab(value);
    const nextSelectedId = value === DashboardTabName.MCPX ? "mcpx" : null;
    setSelectedId(nextSelectedId);
  };

  return (
    <div className="p-4 md:p-6 bg-[var(--color-bg-app)] text-[var(--color-text-primary)] flex flex-col h-screen max-h-screen">
      <div className="flex flex-col flex-grow space-y-4 overflow-hidden">
        <Card className="flex-1 shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] flex flex-col overflow-hidden h-full max-h-[calc(50vh_-_1.5rem_-_8px)]">
          <CardHeader className="flex-shrink-0 border-b border-[var(--color-border-primary)] py-2 px-3 md:py-3 md:px-4">
            <div className="flex justify-between">
              <CardTitle className="text-sm md:text-base font-bold text-[var(--color-text-primary)]">
                System Connectivity
              </CardTitle>
              <Button
                variant="outline"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  openAddServerModal();
                }}
                className="text-[9px] px-1 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
              >
                <Plus className="w-2 h-2 mr-0.5" />
                Add Server
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-grow p-1 md:p-2 overflow-hidden">
            <ConnectivityDiagram
              agents={aiAgents}
              mcpServersData={mcpServers}
              mcpxStatus={mcpxSystemActualStatus}
              onAgentClick={handleAgentSelect}
              onMcpServerClick={handleMcpServerSelect}
              onMcpxClick={handleMcpxSelect}
              selectedId={selectedId}
            />
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
                <AgentsDetails
                  aiAgents={aiAgents}
                  selectedAgent={selectedAgent}
                />
              </TabsContent>

              <TabsContent value={DashboardTabName.MCPX} className="m-0 w-full">
                <McpxDetails
                  aiAgents={aiAgents}
                  configurationData={configurationData}
                />
              </TabsContent>

              <TabsContent
                value={DashboardTabName.Servers}
                className="m-0 w-full"
              >
                <McpServersDetails
                  onSelectedServerDeleted={handleSelectedServerDeleted}
                  selectedServer={selectedServer}
                />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
      {isAddServerModalOpen && (
        <AddServerModal
          isOpen={isAddServerModalOpen}
          onClose={closeAddServerModal}
          onServerAdded={() => {
            closeAddServerModal();
          }}
        />
      )}
      {isEditServerModalOpen && (
        <EditServerModal
          isOpen={isEditServerModalOpen}
          onClose={closeEditServerModal}
          initialData={selectedServer}
        />
      )}
    </div>
  );
}
