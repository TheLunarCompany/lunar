import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Server, Brain, Activity, SlidersHorizontal, Settings2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function AgentControls({ agent, mcpServers, onAccessConfigChange }) {
  const [internalAccessConfig, setInternalAccessConfig] = useState(agent?.access_config || []);

  useEffect(() => {
    setInternalAccessConfig(agent?.access_config || []);
  }, [agent]);

  if (!agent) return null;

  const formatDateTime = (dateTime) => {
    if (!dateTime) return "N/A";
    try {
      return format(new Date(dateTime), 'MMM d, HH:mm');
    } catch (e) {
      return "Invalid date";
    }
  };

  const handleServerToggle = (serverId, allow) => {
    const newConfig = internalAccessConfig.map(sc => 
      sc.server_id === serverId ? { ...sc, allow_server: allow } : sc
    );
    setInternalAccessConfig(newConfig);
    onAccessConfigChange(agent.id, newConfig);
  };

  const handleToolToggle = (serverId, toolName, allow) => {
    const newConfig = internalAccessConfig.map(sc => {
      if (sc.server_id === serverId) {
        return {
          ...sc,
          tools: sc.tools.map(tool => 
            tool.tool_name === toolName ? { ...tool, allow_tool: allow } : tool
          )
        };
      }
      return sc;
    });
    setInternalAccessConfig(newConfig);
    onAccessConfigChange(agent.id, newConfig);
  };
  
  const getServerAccessConfig = (serverId) => {
    return internalAccessConfig.find(conf => conf.server_id === serverId) || 
           { server_id: serverId, server_name: mcpServers.find(s=>s.id === serverId)?.name || "Unknown Server", allow_server: false, tools: [] };
  };

  const getToolAccessConfig = (serverConfig, toolName) => {
     const toolConf = serverConfig.tools.find(t => t.tool_name === toolName);
     return toolConf || { tool_name: toolName, allow_tool: false };
  };

  const ToggleLabel = ({ enabled }) => (
    <span className={`text-[8px] font-medium flex items-center mr-1 ${enabled ? "text-[var(--color-fg-success)]" : "text-[var(--color-fg-danger)]"}`}>
      {enabled ? <CheckCircle className="w-2 h-2 mr-0.5" /> : <XCircle className="w-2 h-2 mr-0.5" />}
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );

  return (
    <div className="h-full overflow-y-auto">
      <CardHeader className="border-b border-[var(--color-border-primary)] py-2 px-3 flex-shrink-0">
        <CardTitle className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-[var(--color-fg-interactive)]" />
          Agent: <span className="truncate max-w-[120px]">{agent.identifier}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-1">
        {/* Agent Information Section */}
        <div className="grid grid-cols-1 gap-1 mb-2 text-[9px]">
          <div className="p-1 bg-[var(--color-bg-container-overlay)] rounded border border-[var(--color-border-info)]">
            <h4 className="font-medium text-[var(--color-text-secondary)] text-[8px] mb-0.5">Session</h4>
            <p><span className="font-semibold">ID:</span> <span className="truncate max-w-[80px] inline-block align-bottom">{agent.sessionId}</span></p>
            <p><span className="font-semibold">Status:</span> <Badge variant="outline" className="ml-1 px-1 py-0 text-[7px] bg-[var(--color-bg-success)] text-[var(--color-fg-success)] border-[var(--color-border-success)]">{agent.status}</Badge></p>
            <p className="text-[8px]">Last Activity: {formatDateTime(agent.last_activity)}</p>
          </div>
          {agent.llm && agent.llm.provider !== "unknown" && (
            <div className="p-1 bg-[var(--color-bg-container-overlay)] rounded border border-[var(--color-border-info)]">
              <h4 className="font-medium text-[var(--color-text-secondary)] text-[8px] mb-0.5 flex items-center gap-1"><Brain className="w-1.5 h-1.5" />LLM</h4>
              <p><span className="font-semibold">Provider:</span> {agent.llm.provider}</p>
              <p><span className="font-semibold">Model:</span> <span className="truncate max-w-[80px] inline-block align-bottom">{agent.llm.model}</span></p>
            </div>
          )}
          {agent.usage && (
            <div className="p-1 bg-[var(--color-bg-container-overlay)] rounded border border-[var(--color-border-info)]">
              <h4 className="font-medium text-[var(--color-text-secondary)] text-[8px] mb-0.5 flex items-center gap-1"><Activity className="w-1.5 h-1.5" />Usage</h4>
              <p><span className="font-semibold">Calls:</span> {agent.usage.callCount}</p>
              <p className="text-[8px]">Last Call: {formatDateTime(agent.usage.lastCalledAt)}</p>
            </div>
          )}
        </div>

        {/* MCP Server Access Controls Section */}
        <div>
          <h4 className="font-medium text-[var(--color-text-primary)] text-[10px] mb-1 flex items-center gap-1">
            <Settings2 className="w-2 h-2" /> MCP Server Access
          </h4>
          <div className="space-y-1">
            {mcpServers.length > 0 ? mcpServers.map(server => {
              const serverConfig = getServerAccessConfig(server.id);
              return (
                <div key={server.id} className="p-1 border border-[var(--color-border-primary)] rounded bg-[var(--color-bg-container-overlay)]">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-[9px] text-[var(--color-text-primary)] flex items-center gap-1">
                      <Server className="w-2 h-2" />{server.name}
                    </span>
                    <div className="flex items-center">
                      <ToggleLabel enabled={serverConfig.allow_server} />
                      <Switch
                        checked={serverConfig.allow_server}
                        onCheckedChange={(checked) => handleServerToggle(server.id, checked)}
                        className="transform scale-[0.5]"
                      />
                    </div>
                  </div>
                  {serverConfig.allow_server && server.tools && server.tools.length > 0 && (
                    <div className="pl-1 space-y-0.5 mt-0.5 border-l-2 border-[var(--color-border-interactive)] ml-1">
                      {server.tools.map(tool => {
                        const toolConfig = getToolAccessConfig(serverConfig, tool.name);
                        return (
                          <div key={tool.name} className="flex items-center justify-between py-0">
                            <span className="text-[9px] text-[var(--color-text-secondary)] flex items-center gap-0.5">
                              <SlidersHorizontal className="w-1.5 h-1.5" /> {tool.name}
                            </span>
                            <div className="flex items-center">
                              <ToggleLabel enabled={toolConfig.allow_tool} />
                              <Switch
                                checked={toolConfig.allow_tool}
                                onCheckedChange={(checked) => handleToolToggle(server.id, tool.name, checked)}
                                className="transform scale-[0.5]"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }) : <p className="text-[9px] text-center text-[var(--color-text-secondary)] py-1">No MCP Servers.</p>}
          </div>
        </div>
      </CardContent>
    </div>
  );
}