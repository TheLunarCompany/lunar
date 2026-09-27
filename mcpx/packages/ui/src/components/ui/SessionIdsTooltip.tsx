import { cn } from "@/lib/utils";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SessionIdsTooltipProps {
  sessionIds: string[];
  className?: string;
}

export const SessionIdsTooltip: React.FC<SessionIdsTooltipProps> = ({
  sessionIds,
  className,
}) => {
  const [primarySessionId] = sessionIds;

  // Defensive: ensure we have at least one session
  if (!primarySessionId) {
    return (
      <div className={cn("text-sm text-gray-600 mb-3 mt-1", className)}>
        Session ID: No active session
      </div>
    );
  }

  const hasMultipleSessions = sessionIds.length > 1;

  return (
    <div className={cn("text-sm text-gray-600 mb-3 mt-1", className)}>
      Session ID: {primarySessionId}
      {hasMultipleSessions && (
        // Radix Tooltip portals its content, so the overflow-y-auto parent in
        // the modal no longer clips it.
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-2 text-gray-500 cursor-help">
              [{sessionIds.length} sessions]
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="end"
            className="max-w-none flex-col items-start gap-1"
          >
            <div className="text-gray-400">All sessions:</div>
            <div className="space-y-0.5">
              {sessionIds.map((id, idx) => (
                <div key={idx} className="font-mono text-xs whitespace-nowrap">
                  {id}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
