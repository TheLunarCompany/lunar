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
      <div
        className={cn("mb-3 mt-1 text-sm text-mcpx-text-secondary", className)}
      >
        Session ID: No active session
      </div>
    );
  }

  const hasMultipleSessions = sessionIds.length > 1;

  return (
    <div
      className={cn("mb-3 mt-1 text-sm text-mcpx-text-secondary", className)}
    >
      Session ID: {primarySessionId}
      {hasMultipleSessions && (
        // Radix Tooltip portals its content, so the overflow-y-auto parent in
        // the modal no longer clips it.
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-2 cursor-help text-mcpx-text-secondary">
              [{sessionIds.length} sessions]
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="end"
            className="max-w-none flex-col items-start gap-1"
          >
            <div className="text-mcpx-text-disabled">All sessions:</div>
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
