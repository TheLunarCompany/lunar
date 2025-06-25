import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStore } from "@/store";
import { format } from "date-fns";
import { Activity, Brain, ShieldCheck, Undo2 } from "lucide-react";

export interface AgentLLM {
  provider: string;
  model: string;
}

export interface AgentUsage {
  callCount: number;
  lastCalledAt?: string | null;
}

export interface Agent {
  id: string;
  identifier: string;
  sessionId: string;
  status: string;
  last_activity?: string | null;
  llm?: AgentLLM;
  usage?: AgentUsage;
}

const formatDateTime = (dateTime: string | null | undefined): string => {
  if (!dateTime) return "N/A";
  try {
    return format(new Date(dateTime), "MMM d, HH:mm");
  } catch (e) {
    return "Invalid date";
  }
};

export const AgentControls = ({ agent }: { agent: Agent }) => {
  const { clearSelection } = useDashboardStore((s) => ({
    clearSelection: s.clearSelection,
  }));

  if (!agent) return null;

  return (
    <>
      <CardHeader className="sticky top-0 z-10 bg-[var(--color-bg-container)] border-b border-[var(--color-border-primary)] py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1 justify-between">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[var(--color-fg-interactive)]" />
            Agent:{" "}
            <span className="truncate max-w-[120px]">{agent.identifier}</span>
          </span>
          <Button
            variant="outline"
            size="xs"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:hover:bg-background disabled:hover:text-[var(--color-fg-interactive)] disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background shadow-sm hover:text-accent-foreground text-[9px] px-1 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] ml-4 hover:bg-[var(--color-bg-container-overlay)] text-[var(--color-text-secondary)] text-sm px-2 py-1"
            onClick={() => clearSelection()}
          >
            <Undo2 className="w-3 h-3 text-[var(--color-fg-interactive)] cursor-pointer" />
            Back to list
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-1">
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
    </>
  );
};
