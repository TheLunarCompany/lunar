import { Card } from "@/components/ui/card";
import { isActive } from "@/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Hammer } from "lucide-react";
import { memo, useMemo } from "react";
import { AgentNode } from "../types";
import { getAgentType } from "../../helpers";
import { agentsData } from "../../constants";
import { useSocketStore } from "@/store";
import { useToolCount } from "@/hooks/useToolCount";

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

  const { availableTools: connectedToolsCount } = useToolCount({
    agent: { sessionIds: data.sessionIds ?? [], status: data.status },
  });

  return (
    <div className="overflow-visible">
      <div
        className="flex flex-col items-center gap-0.5 relative overflow-visible"
        id={`agent-${data.id}`}
      >
        <Card
          className={`relative justify-between overflow-visible rounded-2xl border bg-[#F9F8FB] cursor-pointer flex flex-col
             ${isAgentActive ? "border-[#B4108B] shadow-lg shadow-[#B4108B]/40" : "border-[#DDDCE4]"}
             gap-1 transition-all p-4 pt-3 pr-3 duration-300 hover:shadow-sm`}
        >
          <div
            className="absolute -top-2 -right-4 flex items-center rounded-full px-1 py-0.5 min-w-[1.75rem] justify-center
               bg-[length:100%_100%] bg-[linear-gradient(180deg,#F9FAFD_0%,#E6E6ED_100%)]
               shadow-[0_4px_4px_0_rgba(97,71,209,0.15)] border border-[#C3B4F3]"
            title="Connected tools"
          >
            <Hammer
              className="h-3 w-3 shrink-0 text-[#7D7B98]"
              strokeWidth={2}
            />
            <span className="text-xs font-semibold text-[#5147E4] tabular-nums">
              {connectedToolsCount}
            </span>
          </div>
          <div className="flex items-center gap-2 pr-6">
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
