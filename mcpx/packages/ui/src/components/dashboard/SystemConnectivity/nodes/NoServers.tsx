import { Plus } from "lucide-react";
import { memo, useState } from "react";
import { AddServerModal } from "../../AddServerModal";
import McpServerConnectionIcon from "@/icons/mcp-server-connection.svg?react";
import { NodeCard } from "@/components/ui/node-card";
import { Button } from "@/components/ui/button";

const NoServers = () => {
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);

  return (
    <>
      <NodeCard variant="zero" className="w-[242px] items-center gap-3 p-6">
        <McpServerConnectionIcon
          width={32}
          height={32}
          className="text-[var(--mcpx-selected)]"
        />
        <div className="flex flex-col items-center gap-1 text-center text-sm">
          <span className="font-bold leading-[1.5] text-mcpx-text">
            No MCP Server
          </span>
          <span className="leading-6 text-mcpx-text-secondary">
            Waiting for server connection
          </span>
        </div>
        <Button
          variant="node-card"
          size="sm"
          onClick={() => setIsAddServerModalOpen(true)}
        >
          <Plus data-icon="inline-start" />
          Add Server
        </Button>
      </NodeCard>

      {isAddServerModalOpen && (
        <AddServerModal onClose={() => setIsAddServerModalOpen(false)} />
      )}
    </>
  );
};

export default memo(NoServers);
