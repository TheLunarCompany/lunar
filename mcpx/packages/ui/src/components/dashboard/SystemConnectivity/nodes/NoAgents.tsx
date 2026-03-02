import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgentConnectionIcon } from "@/components/images";
import { Plus } from "lucide-react";
import { memo, useState } from "react";
import { AddAgentModal } from "./AddAgentModal";

const NoAgents = () => {
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);

  return (
    <>
      <Card className="p-4  border border-dashed border-[#5147E4] bg-[#F9F8FB] shadow-sm">
        <div className="flex flex-col items-center gap-[10px]">
          <div className="flex flex-row items-center gap-2">
            <AgentConnectionIcon width={24} height={24} />
            <p className="text-[14px] font-bold text-[#231A4D]">No AI Agent</p>
          </div>
          <p className="text-[14px]  text-[#231A4D]">
            Waiting for agent connection
          </p>

          <Button
            onClick={() => setIsAddAgentModalOpen(true)}
            variant="primary"
            size="xs"
            className=""
          >
            <Plus className="w-2 h-2" />
            Add Agent
          </Button>
        </div>
      </Card>

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
