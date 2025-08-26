import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Server, Plus } from "lucide-react";
import { memo, useState } from "react";
import { AddServerModal } from "../../AddServerModal";

const NoServers = () => {
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);

  return (
    <>
      <Card className="p-2 w-50 border-dashed border-purple-300 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[7px] font-semibold text-gray-700">Waiting for server connection...</p>
          <div className="h-2 w-1 "></div>
          <Button
            onClick={() => setIsAddServerModalOpen(true)}
            variant="outline"
            size="sm"
            className="h-5 px-1 py-1 font-semibold border-purple-300 bg-white text-purple-500 hover:bg-purple-50 hover:border-purple-400 transition-colors text-[6px] flex items-center"
          > 
            <Plus className="w-2 h-2 mr-0.5"/>
            Add Server
          </Button>
        </div>
      </Card>
      
      {isAddServerModalOpen && (
        <AddServerModal
          onClose={() => setIsAddServerModalOpen(false)}
        />
      )}
    </>
  );
};

export default memo(NoServers);
