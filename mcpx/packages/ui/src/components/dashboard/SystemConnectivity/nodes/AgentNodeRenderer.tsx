import { Handle, NodeProps, Position } from "@xyflow/react";
import { Hammer } from "lucide-react";
import { memo } from "react";
import { AgentNode } from "../types";
import { deriveAgentDisplay } from "../../agent-display";
import { useModalsStore } from "@/store";
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
  const selectedAgent = useModalsStore((s) => s.selectedAgent);
  const selected = isRouteSelected || selectedAgent?.id === data.id;

  const display = deriveAgentDisplay(data);

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
                src={display.icon.src}
                alt={display.icon.alt}
                className="min-w-8 w-8 min-h-8 h-8 rounded-md object-contain"
              />
            </NodeCardIcon>
            <div className="flex flex-col gap-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-semibold truncate text-[var(--colors-gray-950)]">
                    {display.title}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{display.title}</TooltipContent>
              </Tooltip>
              {display.subtitle && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block min-w-0 max-w-full">
                      <NodeBadge className="max-w-[112px] min-w-0 justify-start">
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                            {display.subtitle.primary}
                          </span>
                          {display.subtitle.extraCount > 0 && (
                            <span className="shrink-0 text-[var(--colors-gray-500)]">
                              +{display.subtitle.extraCount}
                            </span>
                          )}
                        </span>
                      </NodeBadge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {display.subtitle.extraCount > 0
                      ? `${display.subtitle.primary} +${display.subtitle.extraCount} more`
                      : display.subtitle.primary}
                  </TooltipContent>
                </Tooltip>
              )}
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
