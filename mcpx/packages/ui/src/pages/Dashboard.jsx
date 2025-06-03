import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Keep Button component import

import ConnectivityDiagram from "../components/dashboard/ConnectivityDiagram";
import MCPDetails from "../components/dashboard/MCPDetails";
import MCPXDetailTabs from "../components/dashboard/MCPXDetailTabs"; // New import
import ConfigurationImportModal from "../components/dashboard/ConfigurationImportModal";

const MAX_AGENTS_IN_DIAGRAM = 3;
const MAX_SERVERS_IN_DIAGRAM = 5;

export default function Dashboard({
  importedConfiguration,
  onRequestNewConfigurationUpload,
}) {
  const [configurationData, setConfigurationData] = useState(null);
  const [mcpServers, setMcpServers] = useState([]);
  const [aiAgents, setAiAgents] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [activeView, setActiveView] = useState("mcpxDetails"); // Changed default view
  const [showInitialImportModal, setShowInitialImportModal] = useState(true);
  const [mcpxSystemActualStatus, setMcpxSystemActualStatus] =
    useState("stopped");

  useEffect(() => {
    if (importedConfiguration) {
      console.log(
        "Dashboard received imported configuration:",
        importedConfiguration
      );
      processConfigurationData(importedConfiguration);
      setShowInitialImportModal(false);
    } else {
      const hasLoadedOnce = sessionStorage.getItem("mcpAppConfigLoaded");
      if (!hasLoadedOnce) {
        setShowInitialImportModal(true);
      } else {
        setShowInitialImportModal(false);
        setConfigurationData(null);
        setMcpServers([]);
        setAiAgents([]);
        setActiveView("mcpxDetails"); // Consistent with new default view
      }
    }
  }, [importedConfiguration]);

  const processConfigurationData = (config) => {
    setConfigurationData(config);
    const transformed = transformConfigurationData(config);
    setMcpServers(transformed.servers);
    setAiAgents(transformed.agents);
    setMcpxSystemActualStatus(
      isServerIdle(config?.usage?.lastCalledAt) ? "stopped" : "running"
    );
    setActiveView("mcpxDetails"); // Reset to default view on new config
    setSelectedAgent(null);
    setSelectedServer(null);
    sessionStorage.setItem("mcpAppConfigLoaded", "true");
  };

  // Transform JSON configuration data to our internal format
  const transformConfigurationData = (config) => {
    // Transform targetServers to mcpServers format
    const transformedServers = config.targetServers.map((server, index) => ({
      id: `server-${index}`,
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
      icon: getServerIcon(server.name),
      configuration: {},
      usage: server.usage,
    }));

    // Transform connectedClients to aiAgents format
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

  const isServerIdle = (lastCalledAt) => {
    if (!lastCalledAt) return true;
    const lastCall = new Date(lastCalledAt);
    const now = new Date();
    const diffInMinutes = (now - lastCall) / (1000 * 60);
    return diffInMinutes > 1;
  };

  const getServerIcon = (serverName) => {
    const iconMap = {
      slack: "slack",
      "google-maps": "google-maps",
      github: "github",
    };
    return iconMap[serverName] || "default";
  };

  const handleInitialConfigurationImport = (configData) => {
    // Modified to expect configData.mcpConfig
    processConfigurationData(configData.mcpConfig);
    setShowInitialImportModal(false);
  };

  const handleAgentSelect = (agent) => {
    setSelectedAgent(agent);
    setSelectedServer(null);
    setActiveView("mcpxDetails"); // Agents controls are now part of MCPXDetailTabs
  };

  const handleMCPServerSelect = (server) => {
    setSelectedServer(server);
    setSelectedAgent(null);
    setActiveView("mcpServerDetails");
  };

  const handleMCPXSelect = () => {
    setSelectedServer(null);
    setSelectedAgent(null);
    setActiveView("mcpxDetails"); // MCPX Analytics is now part of MCPXDetailTabs
  };

  const handleMCPXNodeConfigClick = () => {
    if (onRequestNewConfigurationUpload) {
      onRequestNewConfigurationUpload();
    } else {
      console.warn("onRequestNewConfigurationUpload not provided to Dashboard");
      setShowInitialImportModal(true);
    }
  };

  // Removed handleMCPXToggle as per outline
  // Removed handleMCPServerToggle as per outline

  const handleAgentAccessConfigChange = (agentId, newAccessConfig) => {
    setAiAgents((prevAgents) =>
      prevAgents.map((agent) =>
        agent.id === agentId
          ? { ...agent, access_config: newAccessConfig }
          : agent
      )
    );
    if (selectedAgent && selectedAgent.id === agentId) {
      setSelectedAgent((prev) => ({ ...prev, access_config: newAccessConfig }));
    }
  };

  if (showInitialImportModal && !importedConfiguration) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-app)] flex items-center justify-center">
        <ConfigurationImportModal
          isOpen={true}
          onConfigurationImport={handleInitialConfigurationImport}
        />
      </div>
    );
  }

  if (!configurationData && !showInitialImportModal) {
    return (
      <div className="p-4 md:p-6 bg-[var(--color-bg-app)] text-[var(--color-text-primary)] flex flex-col h-full max-h-screen items-center justify-center">
        <Card className="max-w-lg text-center p-8">
          <CardHeader>
            <CardTitle className="text-2xl">No Configuration Loaded</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Please load a system configuration using the "Load New Config"
              button in the sidebar to begin.
            </p>
            <Button
              onClick={
                onRequestNewConfigurationUpload ||
                (() => setShowInitialImportModal(true))
              }
            >
              Load Configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-[var(--color-bg-app)] text-[var(--color-text-primary)] flex flex-col h-screen max-h-screen">
      {" "}
      {/* Changed h-full to h-screen */}
      {/* Header Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
              MCPX Control Plane
            </h1>
            <p className="text-xs md:text-sm text-[var(--color-text-secondary)] mt-1">
              System Overview & Control
            </p>
          </div>
        </div>
      </div>
      {/* Main Content Area: Two Equal Panes */}
      <div className="flex flex-col flex-grow space-y-4 overflow-hidden">
        {/* Top Pane: System Connectivity Diagram (50%) */}
        <Card className="flex-1 shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] flex flex-col overflow-hidden">
          <CardHeader className="flex-shrink-0 border-b border-[var(--color-border-primary)] py-2 px-3 md:py-3 md:px-4">
            <CardTitle className="text-sm md:text-base font-bold text-[var(--color-text-primary)]">
              System Connectivity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow p-1 md:p-2 overflow-hidden">
            <ConnectivityDiagram
              agents={aiAgents.slice(0, MAX_AGENTS_IN_DIAGRAM)}
              mcpxStatus={mcpxSystemActualStatus}
              mcpServersData={mcpServers.slice(0, MAX_SERVERS_IN_DIAGRAM)}
              selectedServer={selectedServer}
              onMCPServerClick={handleMCPServerSelect}
              onMCPXClick={handleMCPXSelect}
              onAgentClick={handleAgentSelect}
              selectedAgent={selectedAgent}
              onOpenMCPXConfigModal={handleMCPXNodeConfigClick}
              // Removed onToggleMCPX and onToggleMCPServerStatus
            />
          </CardContent>
        </Card>

        {/* Bottom Pane: Details/Controls/Analytics Section (50%) */}
        <Card className="flex-1 shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] flex flex-col overflow-hidden">
          {/* Removed CardHeader for the bottom pane as per outline */}
          <CardContent className="flex-grow p-0 overflow-hidden">
            {" "}
            {/* Changed padding to p-0 */}
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
              <MCPDetails selectedServer={selectedServer} />
            )}
            {/* Removed old MCPXAnalytics and AgentControls rendering */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
