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
      <NodeCard variant="zero" className="w-[230px] items-center gap-3 py-6">
        <McpServerConnectionIcon
          width={30}
          height={30}
          className="text-[var(--colors-primary-400)]"
        />
        <div className="flex flex-col items-center gap-1 text-sm">
          <span className="font-semibold text-[var(--colors-gray-950)]">
            No MCP Server
          </span>
          <span className="text-[var(--colors-gray-600)]">
            Waiting for server connection
          </span>
        </div>
        <Button
          variant="node-card"
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
