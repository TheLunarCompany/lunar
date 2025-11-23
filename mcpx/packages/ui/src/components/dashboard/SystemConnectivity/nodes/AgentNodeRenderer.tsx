import { Card } from "@/components/ui/card";
import { isActive } from "@/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Brain } from "lucide-react";
import { memo, useMemo } from "react";
import { StatusIcon } from "../StatusIcon";
import { AgentNode } from "../types";
import { AgentType } from "../../types";
import { getAgentType } from "../../helpers";
import { agentsData } from "../../constants";
import { useSocketStore } from "@/store";

const AgentNodeRenderer = ({ data }: NodeProps<AgentNode>) => {
  const isAgentActive = isActive(data.usage.lastCalledAt);

  const agentType = getAgentType(data.identifier);

  const currentAgentData = agentsData[agentType ?? "DEFAULT"];

  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));

  // Get consumerTag from x-lunar-consumer-tag header
  const consumerTag = useMemo(() => {
    if (!data.sessionIds || data.sessionIds.length === 0) {
      return null;
    }
    const session = systemState?.connectedClients?.find(
      (client) => client.sessionId === data.sessionIds[0],
    );
    return session?.consumerTag || null;
  }, [data.sessionIds, systemState]);

  return (
    <div>
      <div
        className="flex flex-col items-center gap-0.5 relative"
        id={`agent-${data.id}`}
      >
        <Card
          className={` justify-between  rounded-2xl border border-[#DDDCE4] bg-[#F9F8FB] cursor-pointer  flex flex-col
             ${isAgentActive ? "shadow-lg shadow-[#6B6293]/40" : ""}
               gap-1 transition-all p-4 duration-300 hover:shadow-sm`}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-between mb-0.5">
              <img
                src={currentAgentData.icon}
                alt={`${currentAgentData.name} Agent Avatar`}
                className="min-w-8 w-8 min-h-8 h-8 rounded-md"
              />
            </div>
            <div className="flex flex-col items-start justify-start">
            <p className="font-semibold truncate text-ellipsis overflow-hidden  max-w-[80px]  text-[#231A4D] text-[16px] mb-0">
              { currentAgentData.name}
            </p>
            <div className="font-semibold w-fit text-[10px] text-[#7D7B98] mb-0 border border-[#7D7B98] rounded-[4px] px-0.5 inline-block">
            {consumerTag || (currentAgentData.name ==='Default' ? data.identifier : currentAgentData.name)}
          </div>
            </div>
        
          </div>
      
          <Handle
            type="source"
            position={Position.Right}
            className="max-w-0 max-h-0 min-w-0 min-h-0 rounded-none border-none"
          />
        </Card>
      </div>
    </div>
  );
};

export default memo(AgentNodeRenderer);
