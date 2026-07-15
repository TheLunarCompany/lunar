import { McpServersSection } from "@/components/mcp-servers/McpServersSection";
import { useSocketStore } from "@/store";

export default function McpServers() {
  const servers = useSocketStore((s) => s.systemState?.targetServers ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background p-6">
      <McpServersSection servers={servers} />
    </div>
  );
}
