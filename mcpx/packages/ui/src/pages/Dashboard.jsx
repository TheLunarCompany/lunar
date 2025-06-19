import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useModalsStore, useSocketStore } from "@/store";
import sortBy from "lodash/sortBy";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AddServerModal from "../components/dashboard/AddServerModal";
import EditServerModal from "../components/dashboard/EditServerModal";
import MCPDetails from "../components/dashboard/MCPDetails";
import MCPXDetailTabs from "../components/dashboard/MCPXDetailTabs";
import ConnectivityDiagram from "../components/dashboard/SystemConnectivity/ConnectivityDiagram";

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
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [activeView, setActiveView] = useState("mcpxDetails");
  const [mcpxSystemActualStatus, setMcpxSystemActualStatus] =
    useState("stopped");

  const selectedServer = useMemo(() => {
    return mcpServers?.find((server) => server.id === selectedServerId);
  }, [mcpServers, selectedServerId]);
  const selectedAgent = useMemo(() => {
    return aiAgents.find((agent) => agent.id === selectedAgentId);
  }, [aiAgents, selectedAgentId]);

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
      setActiveView("mcpxDetails");
    }
  }, [configurationData]);

  const handleAgentSelect = (agent) => {
    setSelectedAgentId(agent.id);
    setSelectedServerId(null);
    setActiveView("mcpxDetails");
  };

  const handleMcpServerSelect = (server) => {
    if (selectedServerId === server.id) {
      // If the same server is clicked again, do nothing
      return;
    }
    setSelectedServerId(server.id);
    setSelectedAgentId(null);
    setActiveView("mcpServerDetails");
  };

  const handleMcpxSelect = () => {
    setSelectedServerId(null);
    setSelectedAgentId(null);
    setActiveView("mcpxDetails");
  };

  const handleAgentAccessConfigChange = (agentId, newAccessConfig) => {
    setAiAgents((prevAgents) =>
      prevAgents.map((agent) =>
        agent.id === agentId
          ? { ...agent, access_config: newAccessConfig }
          : agent,
      ),
    );
    if (selectedAgentId === agentId) {
      setSelectedAgentId(null);
    }
  };

  const handleSelectedServerDeleted = () => {
    setSelectedServerId(null);
    setActiveView("mcpxDetails");
  };

  return (
    <div className="p-4 md:p-6 bg-[var(--color-bg-app)] text-[var(--color-text-primary)] flex flex-col h-screen max-h-screen">
      <div className="flex flex-col flex-grow space-y-4 overflow-hidden">
        <Card className="flex-1 shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] flex flex-col overflow-hidden">
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
              selectedAgent={selectedAgent}
              selectedServer={selectedServer}
            />
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] flex flex-col overflow-hidden">
          <CardContent className="flex-grow p-0 overflow-hidden">
            {activeView === "mcpxDetails" && configurationData && (
              <MCPXDetailTabs
                configurationData={configurationData}
                mcpServers={mcpServers}
                aiAgents={aiAgents}
                selectedAgent={selectedAgent} // Pass selectedAgent for Agent Controls tab
                onAgentAccessConfigChange={handleAgentAccessConfigChange} // Pass the handler
              />
            )}
            {activeView === "mcpServerDetails" && selectedServer && (
              <MCPDetails
                selectedServer={selectedServer}
                onSelectedServerDeleted={handleSelectedServerDeleted}
              />
            )}
          </CardContent>
        </Card>
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
