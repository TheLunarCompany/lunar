import { McpServersSection } from "@/components/mcp-servers/McpServersSection";
import { PENDO_EVENTS, trackPendoEvent } from "@/components/pendo";
import { useSocketStore } from "@/store";
import { useEffect } from "react";

export default function McpServers() {
  const servers = useSocketStore((s) => s.systemState?.targetServers ?? []);

  useEffect(() => {
    trackPendoEvent(PENDO_EVENTS.mcpServersViewed);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-mcpx-surface p-6">
      <McpServersSection servers={servers} />
    </div>
  );
}
