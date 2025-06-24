import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Activity, Brain, ShieldCheck } from "lucide-react";

interface AgentLLM {
  provider: string;
  model: string;
}

interface AgentUsage {
  callCount: number;
  lastCalledAt?: string | null;
}

interface Agent {
  identifier: string;
  sessionId: string;
  status: string;
  last_activity?: string | null;
  llm?: AgentLLM;
  usage?: AgentUsage;
}

export const AgentControls = ({ agent }: { agent: Agent }) => {
  if (!agent) return null;

  const formatDateTime = (dateTime: string | null | undefined): string => {
    if (!dateTime) return "N/A";
    try {
      return format(new Date(dateTime), "MMM d, HH:mm");
    } catch (e) {
      return "Invalid date";
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <CardHeader className="border-b border-[var(--color-border-primary)] py-2 px-3 flex-shrink-0">
        <CardTitle className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-[var(--color-fg-interactive)]" />
          Agent:{" "}
          <span className="truncate max-w-[120px]">{agent.identifier}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-1">
        {/* Agent Information Section */}
        <div className="grid grid-cols-1 gap-1 mb-2 text-[9px]">
          <div className="p-1 bg-[var(--color-bg-container-overlay)] rounded border border-[var(--color-border-info)]">
            <h4 className="font-medium text-[var(--color-text-secondary)] text-[8px] mb-0.5">
              Session
            </h4>
            <p>
              <span className="font-semibold">ID:</span>{" "}
              <span className="truncate max-w-[80px] inline-block align-bottom">
                {agent.sessionId}
              </span>
            </p>
            <span className="font-semibold">Status:</span>{" "}
            <Badge
              variant="outline"
              className="ml-1 px-1 py-0 text-[7px] bg-[var(--color-bg-success)] text-[var(--color-fg-success)] border-[var(--color-border-success)]"
            >
              {agent.status}
            </Badge>
            <p className="text-[8px]">
              Last Activity: {formatDateTime(agent.last_activity)}
            </p>
          </div>
          {agent.llm && agent.llm.provider !== "unknown" && (
            <div className="p-1 bg-[var(--color-bg-container-overlay)] rounded border border-[var(--color-border-info)]">
              <h4 className="font-medium text-[var(--color-text-secondary)] text-[8px] mb-0.5 flex items-center gap-1">
                <Brain className="w-1.5 h-1.5" />
                LLM
              </h4>
              <p>
                <span className="font-semibold">Provider:</span>{" "}
                {agent.llm.provider}
              </p>
              <p>
                <span className="font-semibold">Model:</span>{" "}
                <span className="truncate max-w-[80px] inline-block align-bottom">
                  {agent.llm.model}
                </span>
              </p>
            </div>
          )}
          {agent.usage && (
            <div className="p-1 bg-[var(--color-bg-container-overlay)] rounded border border-[var(--color-border-info)]">
              <h4 className="font-medium text-[var(--color-text-secondary)] text-[8px] mb-0.5 flex items-center gap-1">
                <Activity className="w-1.5 h-1.5" />
                Usage
              </h4>
              <p>
                <span className="font-semibold">Calls:</span>{" "}
                {agent.usage.callCount}
              </p>
              <p className="text-[8px]">
                Last Call: {formatDateTime(agent.usage.lastCalledAt)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </div>
  );
};
