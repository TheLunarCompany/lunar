import { Card } from "@/components/ui/card";
import { isActive } from "@/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { memo, useMemo } from "react";
import { AgentNode } from "../types";
import { getAgentType } from "../../helpers";
import { agentsData } from "../../constants";
import { useSocketStore } from "@/store";

const AgentNodeRenderer = ({ data }: NodeProps<AgentNode>) => {
  const isAgentActive = isActive(data.usage.lastCalledAt);

  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));

  // Get consumerTag from x-lunar-consumer-tag header
  const consumerTag = useMemo(() => {
    if (!data.sessionIds || data.sessionIds.length === 0) {
      return null;
    }
    const lastSessionId = data.sessionIds[data.sessionIds.length - 1];
    const session = systemState?.connectedClients?.find(
      (client) => client.sessionId === lastSessionId,
    );
    return session?.consumerTag || null;
  }, [data.sessionIds, systemState]);

  const agentType = getAgentType(data.identifier, consumerTag);

  const currentAgentData = agentsData[agentType ?? "DEFAULT"];

  // Truncate text to 16 characters
  const truncateText = (text: string, maxLength: number = 16): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  const displayName = useMemo(() => {
    return truncateText(currentAgentData.name);
  }, [currentAgentData.name]);

  const displayTag = useMemo(() => {
    const tagText =
      consumerTag ||
      (currentAgentData.name === "Default"
        ? data.identifier
        : currentAgentData.name);
    return truncateText(tagText);
  }, [consumerTag, currentAgentData.name, data.identifier]);

  return (
    <div>
      <div
        className="flex flex-col items-center gap-0.5 relative"
        id={`agent-${data.id}`}
      >
        <Card
          className={` justify-between  rounded-2xl border bg-[#F9F8FB] cursor-pointer  flex flex-col
             ${isAgentActive ? "border-[#B4108B] shadow-lg shadow-[#B4108B]/40" : "border-[#DDDCE4]"}
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
              <p className="font-semibold truncate text-ellipsis overflow-hidden  max-w-[100px]  text-[#231A4D] text-[16px] mb-0">
                {displayName}
              </p>
              <div className="font-semibold max-w-[100px] truncate w-fit text-[10px] text-[#7D7B98] mb-0 border border-[#7D7B98] rounded-[4px] px-0.5 inline-block">
                {displayTag}
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
