import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { memo, useState } from "react";
import { AddServerModal } from "../../AddServerModal";
import DatabaseIcon from "@/components/images/DatabaseIcon";

const NoServers = () => {
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);

  return (
    <>
      <Card className="p-4  border border-dashed border-[#5147E4] bg-[#F9F8FB] shadow-sm">
        <div className="flex flex-col items-center gap-[10px]">
          <div className="flex flex-row items-center gap-2">
            <DatabaseIcon width={24} height={24} />
            <p className="text-[14px] font-bold text-[#231A4D]">
              No MCP Server
            </p>
          </div>
          <p className="text-[14px]  text-[#231A4D]">
            Waiting for server connection
          </p>
          <Button
            onClick={() => setIsAddServerModalOpen(true)}
            variant="primary"
            size="xs"
          >
            <Plus className="w-2 h-2 mr-1" />
            Add Server
          </Button>
        </div>
      </Card>

      {isAddServerModalOpen && (
        <AddServerModal onClose={() => setIsAddServerModalOpen(false)} />
      )}
    </>
  );
};

export default memo(NoServers);
