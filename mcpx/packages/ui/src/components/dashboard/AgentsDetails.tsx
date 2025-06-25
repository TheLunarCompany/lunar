import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardStore } from "@/store";
import { CircleX, ShieldCheck, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Agent, AgentControls } from "./AgentControls";
import { DashboardScrollArea } from "./DashboardScrollArea";

export const AgentsDetails = ({
  aiAgents,
  selectedAgent,
}: {
  aiAgents: Agent[];
  selectedAgent: Agent | null;
}) => {
  const { setSelectedId } = useDashboardStore((s) => ({
    setSelectedId: s.setSelectedId,
  }));
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    if (!search) return aiAgents;
    return aiAgents.filter((agent) =>
      agent.identifier.toLowerCase().includes(search.toLowerCase()),
    );
  }, [aiAgents, search]);

  const inputRef = useRef<HTMLInputElement>(null);

  if (!aiAgents?.length) {
    // If no agents are available, show a placeholder
    return (
      <DashboardScrollArea>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center text-[var(--color-text-secondary)]">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No Agents</p>
          </div>
        </div>
      </DashboardScrollArea>
    );
  }

  if (!selectedAgent) {
    // If no agent is selected, show the list of agents
    return (
      <DashboardScrollArea>
        <div className="flex flex-col h-full relative">
          <div className="sticky top-0 z-10 bg-[var(--color-bg-container)] border-b border-[var(--color-border-primary)] py-2 px-3 flex-shrink-0">
            <CardTitle className="flex items-center justify-between gap-1">
              <span className="text-sm flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[var(--color-fg-interactive)]" />
                Agents List
              </span>
              <span className="flex items-center rounded border border-[var(--color-border-secondary)] w-48">
                <Input
                  className="border-none focus:border-1 placeholder:text-[var(--color-text-secondary)] font-normal text-sm h-7"
                  placeholder="Search agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  ref={inputRef}
                />
                {search && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => {
                          setSearch("");
                          inputRef.current?.focus();
                        }}
                        variant="icon"
                        className="hover:text-[var(--color-fg-interactive)] focus:text-[var(--color-fg-interactive)] focus-visible:bg-[var(--color-bg-container-overlay)] h-7 w-4 rounded-none"
                      >
                        <CircleX />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      align="center"
                      className="shadow bg-[var(--color-bg-container)] text-[var(--color-fg-info)] text-xs"
                    >
                      Clear search
                    </TooltipContent>
                  </Tooltip>
                )}
              </span>
            </CardTitle>
          </div>
          {search && filteredList.length === 0 && (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center text-[var(--color-text-secondary)]">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No results found</p>
                <Button
                  variant="outline"
                  size="xs"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:hover:bg-background disabled:hover:text-[var(--color-fg-interactive)] disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background shadow-sm hover:text-accent-foreground text-[9px] px-1 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] mt-4 hover:bg-[var(--color-bg-container-overlay)] text-[var(--color-text-secondary)] text-sm px-2 py-1"
                  onClick={() => setSearch("")}
                >
                  <CircleX className="w-3 h-3 text-[var(--color-fg-interactive)] cursor-pointer" />
                  Clear Search
                </Button>
              </div>
            </div>
          )}
          {filteredList.map((agent, index) => (
            <CardTitle
              key={`${agent.id}_${index}`}
              className="text-sm font-bold text-[var(--color-text-primary)]] py-2 px-3 hover:bg-[var(--color-bg-container-overlay)] cursor-pointer select-none border-b border-[var(--color-border-primary)] hover:bg-[var(--color-bg-container-overlay)] border-b hover:border-[var(--color-border-info)] gap-3 grid grid-cols-[auto_1fr] grid-cols-[minmax(min-content,_240px)_1fr] leading-8"
              onClick={() => setSelectedId(agent.id)}
            >
              <span className="flex items-center whitespace-nowrap gap-1">
                <ShieldCheck className="w-3 h-3 text-[var(--color-fg-interactive)]" />
                Agent:{" "}
                <span className="truncate max-w-[240px] text-[var(--color-fg-interactive)]">
                  {agent.identifier}
                </span>
              </span>
              <span className="truncate max-w-[370px]">
                Session ID: {agent.sessionId}
              </span>
            </CardTitle>
          ))}
        </div>
      </DashboardScrollArea>
    );
  }

  // Render selected agent details
  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full relative">
        <AgentControls agent={selectedAgent} />
      </div>
    </DashboardScrollArea>
  );
};
