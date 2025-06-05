import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Activity, Wrench, ChevronLeft, ChevronRight, Clock, Info } from "lucide-react";
import { format } from "date-fns";

const TOOLS_PER_PAGE = 3; // Reduced to fit more compactly

export default function MCPDetails({ selectedServer }) {
  const [currentToolPage, setCurrentToolPage] = useState(1);

  if (!selectedServer) return null;

  const isRunning = selectedServer.status === "connected_running";
  const isConnected = selectedServer.status === "connected_running" || selectedServer.status === "connected_stopped";
  
  const tools = selectedServer.tools || [];
  const totalToolPages = Math.ceil(tools.length / TOOLS_PER_PAGE);
  const startIndex = (currentToolPage - 1) * TOOLS_PER_PAGE;
  const endIndex = startIndex + TOOLS_PER_PAGE;
  const paginatedTools = tools.slice(startIndex, endIndex);

  const formatLastCalled = (lastCalledAt) => {
    if (!lastCalledAt) return "Never";
    try {
      return format(new Date(lastCalledAt), 'MMM d, HH:mm');
    } catch (e) {
      return "Invalid date";
    }
  };

  const isToolIdle = (lastCalledAt) => {
    if (!lastCalledAt) return true; // Consider tool idle if never called
    const lastCall = new Date(lastCalledAt);
    const now = new Date();
    const diffInMinutes = (now - lastCall) / (1000 * 60);
    return diffInMinutes > 1; // Idle if last call was more than 1 minute ago
  };

  return (
    <div className="flex flex-col h-full">
      <CardHeader className="border-b border-[var(--color-border-primary)] py-2 px-3"> {/* Compact header */}
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5"> {/* Smaller title */}
            <Wrench className="w-4 h-4 text-[var(--color-fg-interactive)]" />
            Server: {selectedServer.name}
          </CardTitle>
          <Badge className={`text-[10px] px-1.5 py-0 ${ /* Smaller badge */
            isRunning ? "bg-[var(--color-bg-success)] text-[var(--color-fg-success)] border-[var(--color-border-success)]" :
            isConnected ? "bg-[var(--color-bg-info)] text-[var(--color-fg-info)] border-[var(--color-border-info)]" :
            "bg-[var(--color-bg-neutral)] text-[var(--color-text-secondary)] border-[var(--color-border-primary)]"
          }`}>
            {isRunning && <Zap className="w-2 h-2 mr-0.5" />}
            {isRunning ? "Run" : isConnected ? "Stop" : "N/A"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2 space-y-1 flex-grow overflow-y-auto"> {/* Compact content, scroll */}
        <div className="p-1.5 bg-[var(--color-bg-container-overlay)] rounded border border-[var(--color-border-info)] text-xs mb-1">
           <h4 className="font-medium text-[var(--color-text-secondary)] text-[10px] mb-0.5 flex items-center gap-1"><Info className="w-2.5 h-2.5" />Server Info</h4>
          <p className="text-[10px] text-[var(--color-text-secondary)]">
            {tools.length} tools available
          </p>
          {selectedServer.usage && (
            <div className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
              <span>Calls: {selectedServer.usage.callCount} | </span>
              <span>Last Active: {formatLastCalled(selectedServer.usage.lastCalledAt)}</span>
            </div>
          )}
        </div>

        <div>
          <h4 className="font-medium text-xs text-[var(--color-text-primary)] mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Available Tools
          </h4>
          
          {paginatedTools.length > 0 ? (
            paginatedTools.map((tool, index) => {
              const isIdle = isToolIdle(tool.lastCalledAt);
              return (
                <div 
                  key={index}
                  className={`flex items-start justify-between p-1.5 rounded border mb-1 ${ /* Compact tool item */
                    isIdle && tool.invocations > 0
                      ? "bg-[var(--color-bg-warning)] border-[var(--color-border-warning)]" 
                      : "bg-[var(--color-bg-container-overlay)] border-[var(--color-border-info)]"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-0.5">
                      <h5 className="font-medium text-[11px] text-[var(--color-text-primary)]">{tool.name}</h5>
                      {isIdle && tool.invocations > 0 && <Clock className="w-2.5 h-2.5 text-[var(--color-fg-warning)]" />}
                    </div>
                    <p className="text-[10px] text-[var(--color-text-secondary)] leading-tight mb-0.5">{tool.description}</p>
                    <p className="text-[9px] text-[var(--color-text-disabled)]">
                      Last called: {formatLastCalled(tool.lastCalledAt)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 bg-[var(--color-bg-container)] border-[var(--color-border-primary)] text-[var(--color-text-secondary)] whitespace-nowrap">
                    {tool.invocations || 0} calls
                  </Badge>
                </div>
              );
            })
          ) : (
            <div className="text-center py-2 text-[var(--color-text-secondary)]">
              <Wrench className="w-4 h-4 mx-auto mb-0.5 opacity-50" />
              <p className="text-[10px]">No tools configured</p>
            </div>
          )}

          {totalToolPages > 1 && (
            <div className="flex items-center justify-between pt-1 mt-1 border-t border-[var(--color-border-primary)]">
              <Button
                variant="outline"
                size="xs" 
                onClick={() => setCurrentToolPage(p => Math.max(1, p - 1))}
                disabled={currentToolPage === 1}
                className="text-[10px] px-1.5 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
              >
                <ChevronLeft className="w-2.5 h-2.5 mr-0.5" /> Prev
              </Button>
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                Page {currentToolPage} of {totalToolPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentToolPage(p => Math.min(totalToolPages, p + 1))}
                disabled={currentToolPage === totalToolPages}
                className="text-[10px] px-1.5 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
              >
                Next <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </div>
  );
}