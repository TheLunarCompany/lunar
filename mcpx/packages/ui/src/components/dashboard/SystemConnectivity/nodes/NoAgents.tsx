import { Plus } from "lucide-react";
import { memo, useState } from "react";
import { AddAgentModal } from "./AddAgentModal";
import AgentConnectionIcon from "@/icons/agent-connection.svg?react";
import { NodeCard } from "@/components/ui/node-card";
import { Button } from "@/components/ui/button";

const NoAgents = () => {
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);

  return (
    <>
      <NodeCard variant="zero" className="w-[242px] items-center gap-3 p-6">
        <AgentConnectionIcon
          width={32}
          height={32}
          className="text-[var(--mcpx-selected)]"
        />
        <div className="flex flex-col items-center gap-1 text-center text-sm">
          <span className="font-bold leading-[1.5] text-mcpx-text">
            No AI Agent
          </span>
          <span className="leading-6 text-mcpx-text-secondary">
            Waiting for agent connection
          </span>
        </div>
        <Button
          variant="node-card"
          size="sm"
          onClick={() => setIsAddAgentModalOpen(true)}
        >
          <Plus data-icon="inline-start" />
          Add Agent
        </Button>
      </NodeCard>

      {isAddAgentModalOpen && (
        <AddAgentModal
          isOpen={isAddAgentModalOpen}
          onClose={() => setIsAddAgentModalOpen(false)}
        />
      )}
    </>
  );
};

export default memo(NoAgents);
