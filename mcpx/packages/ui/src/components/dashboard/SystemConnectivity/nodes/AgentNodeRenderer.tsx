import { Handle, NodeProps, Position } from "@xyflow/react";
import { Hammer } from "lucide-react";
import { memo, useMemo } from "react";
import { AgentNode } from "../types";
import { getAgentType } from "../../helpers";
import { agentsData } from "../../constants";
import { useModalsStore, useSocketStore } from "@/store";
import { useToolCount } from "@/hooks/useToolCount";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NodeCard, NodeBadge, NodeCardIcon } from "@/components/ui/node-card";

const AgentNodeRenderer = ({
  data,
  selected: isRouteSelected = false,
}: NodeProps<AgentNode>) => {
  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));
  const selectedAgent = useModalsStore((s) => s.selectedAgent);
  const selected = isRouteSelected || selectedAgent?.id === data.id;

  const consumerTag = useMemo(() => {
    if (!data.sessionIds || data.sessionIds.length === 0) {
      return null;
    }
    const lastSessionId = data.sessionIds[data.sessionIds.length - 1];
    const session = systemState?.connectedClients?.find(
      (client) => client.sessionId === lastSessionId,
    );
    return (
      session?.consumerTag ||
      session?.clientInfo?.name ||
      data.identifier ||
      null
    );
  }, [data.sessionIds, systemState, data.identifier]);

  const agentType = getAgentType(data.identifier, consumerTag);
  const currentAgentData = agentsData[agentType ?? "DEFAULT"];

  const displayTag = useMemo(() => {
    return (
      consumerTag ||
      (currentAgentData.name === "Default"
        ? data.identifier
        : currentAgentData.name)
    );
  }, [consumerTag, currentAgentData.name, data.identifier]);

  const { availableTools: connectedToolsCount } = useToolCount({
    agent: {
      sessionIds: data.sessionIds ?? [],
      status: data.status,
      identifier: data.identifier,
    },
  });

  return (
    <div className="overflow-visible">
      <div
        className="flex flex-col items-center gap-0.5 relative overflow-visible"
        id={`agent-${data.id}`}
      >
        <NodeCard
          variant="default"
          state={selected ? "active" : "default"}
          className="w-[200px] cursor-pointer overflow-visible"
        >
          {/* Tool count badge */}
          <div
            className="absolute -top-2 -right-4 flex items-center rounded-full px-1 py-0.5 min-w-7 justify-center
               bg-size-[100%_100%] bg-[linear-gradient(180deg,#F9FAFD_0%,#E6E6ED_100%)]
               shadow-[0_4px_4px_0_rgba(97,71,209,0.15)] border border-[#C3B4F3]"
            title="Connected tools"
          >
            <Hammer
              className="h-3 w-3 shrink-0 text-[var(--colors-gray-500)]"
              strokeWidth={2}
            />
            <span className="text-xs font-semibold text-[var(--colors-primary-500)] tabular-nums">
              {connectedToolsCount}
            </span>
          </div>

          <div className="flex items-center gap-3 min-w-0 w-full">
            <NodeCardIcon>
              <img
                src={currentAgentData.icon}
                alt={`${currentAgentData.name} Agent Avatar`}
                className="min-w-8 w-8 min-h-8 h-8 rounded-md object-contain"
              />
            </NodeCardIcon>
            <div className="flex flex-col gap-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-semibold truncate text-[var(--colors-gray-950)]">
                    {currentAgentData.name}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{currentAgentData.name}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block min-w-0 max-w-full">
                    <NodeBadge className="max-w-[112px] min-w-0 justify-start">
                      <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {displayTag}
                      </span>
                    </NodeBadge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {consumerTag || data.identifier}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <Handle
            type="source"
            position={Position.Right}
            className="max-w-0 max-h-0 min-w-0 min-h-0 rounded-none border-none"
          />
        </NodeCard>
      </div>
    </div>
  );
};

export default memo(AgentNodeRenderer);
