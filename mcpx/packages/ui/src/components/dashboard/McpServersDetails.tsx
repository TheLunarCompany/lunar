import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteMcpServer } from "@/data/mcp-server";
import { useModalsStore } from "@/store";
import { format } from "date-fns";
import {
  Activity,
  Clock,
  Edit,
  Info,
  Server,
  Unlink,
  Wrench,
} from "lucide-react";
import { DashboardScrollArea } from "./DashboardScrollArea";

interface Tool {
  name: string;
  description: string;
  lastCalledAt?: string | null;
  invocations?: number;
}

interface ServerUsage {
  callCount: number;
  lastCalledAt?: string | null;
}

interface McpServer {
  name: string;
  status: string;
  tools?: Tool[];
  usage?: ServerUsage;
}

export const McpServersDetails = ({
  onSelectedServerDeleted,
  selectedServer,
}: {
  onSelectedServerDeleted: () => void;
  selectedServer: any;
}) => {
  const { openEditServerModal } = useModalsStore(({ openEditServerModal }) => ({
    openEditServerModal,
  }));
  const { mutate: deleteServer } = useDeleteMcpServer();

  if (!selectedServer)
    return (
      <DashboardScrollArea>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center text-[var(--color-text-secondary)]">
            <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Select an MCP Server from the diagram to view its details
            </p>
          </div>
        </div>
      </DashboardScrollArea>
    );

  const isRunning = selectedServer.status === "connected_running";
  const isConnected =
    selectedServer.status === "connected_running" ||
    selectedServer.status === "connected_stopped";

  const tools = selectedServer.tools || [];

  const formatLastCalled = (lastCalledAt?: string | null): string => {
    if (!lastCalledAt) return "Never";
    try {
      return format(new Date(lastCalledAt), "MMM d, HH:mm");
    } catch (e) {
      return "Invalid date";
    }
  };

  const isToolIdle = (lastCalledAt?: string | null): boolean => {
    if (!lastCalledAt) return true; // Consider tool idle if never called
    const lastCall = new Date(lastCalledAt);
    const now = new Date();
    const diffInMinutes = (now.getTime() - lastCall.getTime()) / (1000 * 60);
    return diffInMinutes > 1; // Idle if last call was more than 1 minute ago
  };

  const handleRemoveServer = () => {
    if (window.confirm("Are you sure you want to remove this server?")) {
      deleteServer({
        name: selectedServer.name,
      });
      onSelectedServerDeleted();
    }
  };

  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full relative">
        <CardHeader className="sticky top-0 z-10 bg-[var(--color-bg-container)] border-b border-[var(--color-border-primary)] space-y-1.5 p-6 py-2 px-3 md:py-3 md:px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-[var(--color-fg-interactive)]" />
              Server: {selectedServer.name}
            </CardTitle>

            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="xs"
                onClick={openEditServerModal}
                className="w-full text-[9px] px-1 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
              >
                <Edit className="w-2 h-2 mr-0.5" />
                Edit Server
              </Button>
              <Button
                className="border-[var(--color-border-danger)] text-[var(--color-fg-danger)] hover:text-[var(--color-fg-danger)] bg-[var(--color-bg-danger)] hover:bg-[var(--color-bg-danger-hover)] text-[9px] px-1 py-0.5 [&_svg]:pointer-events-none h-6"
                variant="outline"
                onClick={handleRemoveServer}
                size="xs"
              >
                <Unlink className="w-2 h-2 mr-0.5" />
                Remove Server
              </Button>
              {/* <Badge
            className={`text-[10px] px-1.5 py-0 ${
              isRunning
              ? "bg-[var(--color-bg-success)] text-[var(--color-fg-success)] border-[var(--color-border-success)]"
              : isConnected
              ? "bg-[var(--color-bg-info)] text-[var(--color-fg-info)] border-[var(--color-border-info)]"
              : "bg-[var(--color-bg-neutral)] text-[var(--color-text-secondary)] border-[var(--color-border-primary)]"
              }`}
              >
              {isRunning && <Zap className="w-2 h-2 mr-0.5" />}
              {isRunning ? "Run" : isConnected ? "Stop" : "N/A"}
              </Badge> */}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto space-y-1.5 p-6 py-2 px-3 md:py-3 md:px-4">
          <div className="p-1.5 bg-[var(--color-bg-container-overlay)] rounded border border-[var(--color-border-info)] text-xs mb-1">
            <h4 className="font-medium text-[var(--color-text-secondary)] text-[10px] mb-0.5 flex items-center gap-1">
              <Info className="w-2.5 h-2.5" />
              Server Info
            </h4>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {tools.length} tools available
            </p>
            {selectedServer.usage && (
              <div className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                <span>Calls: {selectedServer.usage.callCount} | </span>
                <span>
                  Last Active:{" "}
                  {formatLastCalled(selectedServer.usage.lastCalledAt)}
                </span>
              </div>
            )}
          </div>
          <div>
            <h4 className="font-medium text-xs text-[var(--color-text-primary)] mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Available Tools
            </h4>

            {tools.length > 0 ? (
              tools.map((tool: Tool, index: number) => {
                const isIdle: boolean = isToolIdle(tool.lastCalledAt);
                return (
                  <div
                    key={index}
                    className={`flex items-start justify-between p-1.5 rounded border mb-1 ${
                      /* Compact tool item */
                      isIdle && tool.invocations && tool.invocations > 0
                        ? "bg-[var(--color-bg-warning)] border-[var(--color-border-warning)]"
                        : "bg-[var(--color-bg-container-overlay)] border-[var(--color-border-info)]"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1 mb-0.5">
                        <h5 className="font-medium text-[11px] text-[var(--color-text-primary)]">
                          {tool.name}
                        </h5>
                        {isIdle && tool.invocations && tool.invocations > 0 && (
                          <Clock className="w-2.5 h-2.5 text-[var(--color-fg-warning)]" />
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--color-text-secondary)] leading-tight mb-0.5">
                        {tool.description}
                      </p>
                      <p className="text-[9px] text-[var(--color-text-disabled)]">
                        Last called: {formatLastCalled(tool.lastCalledAt)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 ml-1 bg-[var(--color-bg-container)] border-[var(--color-border-primary)] text-[var(--color-text-secondary)] whitespace-nowrap"
                    >
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
          </div>
        </CardContent>
      </div>
    </DashboardScrollArea>
  );
};
