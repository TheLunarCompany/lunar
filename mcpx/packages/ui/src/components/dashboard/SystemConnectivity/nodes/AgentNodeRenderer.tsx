import { Card } from "@/components/ui/card";
import { isActive } from "@/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Brain } from "lucide-react";
import { memo } from "react";
import { StatusIcon } from "../StatusIcon";
import { AgentNode } from "../types";
import { AgentType } from "../../types";
import { getAgentType } from "../../helpers";

const AgentNodeRenderer = ({ data }: NodeProps<AgentNode>) => {
  const isAgentActive = isActive(data.usage.lastCalledAt);

  const agentType = getAgentType(data.identifier);

  const agentsData: Record<AgentType, { icon: string; name: string }> = {
    CLAUDE: {
      icon: "/img/claude_icon_mcp.png",
      name: "Cloude",
    },
    CURSOR: {
      icon: "/img/cursor_icon_mcp.jpg",
      name: "Cursor",
    },
    WIND_SURF: {
      icon: "/img/windsurf_icon_mcp.png",
      name: "Windsurf",
    },
    DEFAULT: {
      icon: "/img/default_icon_mcp.png",
      name: "Default",
    },
  };

  const currentAgentData = agentsData[agentType ?? "DEFAULT"];

  return (
    <div>
      <div
        className="flex flex-col items-center gap-0.5 relative"
        id={`agent-${data.id}`}
      >
        <Card
          className={`cursor-pointer min-w-24 w-max flex flex-col
             ${isAgentActive ? "border-[#B4108B] shadow-lg shadow-[#B4108B]/40" : "border-[#DDDCE4]"}
               gap-1 transition-all p-1.5 duration-300 hover:shadow-sm`}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-between mb-0.5">
              <img
                src={currentAgentData.icon}
                alt={`${currentAgentData.name} Agent Avatar`}
                className="min-w-6 w-6 min-h-6 h-6 rounded-md"
              />
            </div>
            <h3 className="font-semibold max-w-20 text-ellipsis overflow-hidden  text-[var(--color-text-primary)] text-[9px] mb-0">
              {currentAgentData.name ==='Default' ? data.identifier : currentAgentData.name}
            </h3>
          </div>
          <h3 className="font-semibold text-[8px] text-[var(--color-text-secondary)] mb-0">
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
