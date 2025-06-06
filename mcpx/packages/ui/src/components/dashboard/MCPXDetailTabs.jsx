import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Users } from "lucide-react";
import MCPXAnalytics from "./MCPXAnalytics";
import AgentControls from "./AgentControls";

export default function MCPXDetailTabs({
  configurationData,
  mcpServers,
  aiAgents,
  selectedAgent,
  onAgentAccessConfigChange,
}) {
  const [activeTab, setActiveTab] = useState("analytics");

  return (
    <Card className="shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)] h-full flex flex-col">
      <CardHeader className="border-b border-[var(--color-border-primary)] py-2 px-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-[var(--color-text-primary)]">
            MCPX Details
          </CardTitle>
          <div className="flex space-x-1 bg-[var(--color-bg-container-overlay)] p-0.5 rounded-lg">
            <Button
              variant={activeTab === "analytics" ? "default" : "ghost"}
              size="xs"
              onClick={() => setActiveTab("analytics")}
              className={`text-[9px] px-2 py-1 ${
                activeTab === "analytics"
                  ? "bg-[var(--color-fg-interactive)] text-[var(--color-text-primary-inverted)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <BarChart3 className="w-2.5 h-2.5 mr-1" />
              Analytics
            </Button>
            <Button
              variant={activeTab === "access" ? "default" : "ghost"}
              size="xs"
              onClick={() => setActiveTab("access")}
              className={`text-[9px] px-2 py-1 ${
                activeTab === "access"
                  ? "bg-[var(--color-fg-interactive)] text-[var(--color-text-primary-inverted)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Users className="w-2.5 h-2.5 mr-1" />
              Agent Access
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        {activeTab === "analytics" && (
          <MCPXAnalytics
            configurationData={configurationData}
            mcpServers={mcpServers}
            aiAgents={aiAgents}
          />
        )}
        {activeTab === "access" && (
          <div className="h-full">
            {selectedAgent ? (
              <AgentControls
                agent={selectedAgent}
                mcpServers={mcpServers}
                onAccessConfigChange={onAgentAccessConfigChange}
              />
            ) : (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center text-[var(--color-text-secondary)]">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Select an AI Agent from the diagram to configure access
                    controls
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
