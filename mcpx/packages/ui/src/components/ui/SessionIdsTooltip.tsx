import React from "react";

interface SessionIdsTooltipProps {
  sessionIds: string[];
}

export const SessionIdsTooltip: React.FC<SessionIdsTooltipProps> = ({
  sessionIds,
}) => {
  const [primarySessionId, ..._otherSessions] = sessionIds;

  // Defensive: ensure we have at least one session
  if (!primarySessionId) {
    return (
      <div className="text-sm text-gray-600 mb-3 mt-1">
        Session ID: No active session
      </div>
    );
  }

  const hasMultipleSessions = sessionIds.length > 1;

  return (
    <div className="text-sm text-gray-600 mb-3 mt-1">
      Session ID: {primarySessionId}
      {hasMultipleSessions && (
        <span className="ml-2 text-gray-500 cursor-help relative inline-block group">
          [{sessionIds.length} sessions]
          <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-gray-800 text-white text-xs p-2 rounded shadow-lg whitespace-nowrap z-50 max-w-[500px] overflow-x-auto">
            <div className="text-gray-400 mb-1">All sessions:</div>
            <div className="space-y-0.5">
              {sessionIds.map((id, idx) => (
                <div key={idx} className="font-mono text-xs">
                  {id}
                </div>
              ))}
            </div>
          </div>
        </span>
      )}
    </div>
  );
};
