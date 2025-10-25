import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { memo, useState } from "react";
import { AddServerModal } from "../../AddServerModal";

const NoServers = () => {
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);

  return (
    <>
      <Card className="p-2 w-50 border-dashed border-gray-300 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-1">
          <h3 className="text-xs font-semibold text-gray-800 mb-2">
            Waiting for server connection...
          </h3>
          <Button
            onClick={() => setIsAddServerModalOpen(true)}
            variant="secondary"
            size="sm"
            className="h-6 px-2 text-[10px] border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
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
