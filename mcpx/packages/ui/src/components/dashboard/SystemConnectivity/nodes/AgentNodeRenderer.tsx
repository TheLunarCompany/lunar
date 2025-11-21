import { Card } from "@/components/ui/card";
import { isActive } from "@/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Brain } from "lucide-react";
import { memo } from "react";
import { StatusIcon } from "../StatusIcon";
import { AgentNode } from "../types";
import { AgentType } from "../../types";
import { getAgentType } from "../../helpers";
import { agentsData } from "../../constants";

const AgentNodeRenderer = ({ data }: NodeProps<AgentNode>) => {
  const isAgentActive = isActive(data.usage.lastCalledAt);

  const agentType = getAgentType(data.identifier);

  const currentAgentData = agentsData[agentType ?? "DEFAULT"];

  return (
    <div>
      <div
        className="flex flex-col items-center gap-0.5 relative"
        id={`agent-${data.id}`}
      >
        <Card
          className={`h-[90px] rounded-xl   cursor-pointer w-[120px] flex flex-col
             ${isAgentActive ? "border-[#DDDCE4] shadow-lg shadow-[#6B6293]/40" : "border-[#DDDCE4]"}
               gap-1 transition-all p-4 duration-300 hover:shadow-sm`}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-between mb-0.5">
              <img
                src={currentAgentData.icon}
                alt={`${currentAgentData.name} Agent Avatar`}
                className="min-w-6 w-6 min-h-6 h-6 rounded-md"
              />
            </div>
            <p className="font-semibold text-ellipsis overflow-hidden  text-[#231A4D] text-[14px] mb-0">
              {currentAgentData.name ==='Default' ? data.identifier : currentAgentData.name}
            </p>
          </div>
          <h3 className="font-semibold text-[12px] text-[var(--color-text-secondary)] mb-0">
            AI Agent
          </h3>
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
