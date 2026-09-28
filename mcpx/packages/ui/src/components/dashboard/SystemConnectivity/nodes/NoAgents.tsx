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
      <NodeCard variant="zero" className="w-[230px] items-center gap-3 py-6">
        <AgentConnectionIcon
          width={30}
          height={30}
          className="text-[var(--colors-primary-400)]"
        />
        <div className="flex flex-col items-center gap-1 text-sm">
          <span className="font-semibold text-[var(--colors-gray-950)]">
            No AI Agent
          </span>
          <span className="text-[var(--colors-gray-600)]">
            Waiting for agent connection
          </span>
        </div>
        <Button
          variant="node-card"
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
