import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardStore, useModalsStore } from "@/store";
import { Agent } from "@/types";
import { formatDateTime, formatRelativeTime, isActive } from "@/utils";
import {
  Activity,
  Brain,
  CircleX,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { DashboardScrollArea } from "./DashboardScrollArea";
import { AgentDetailsModal } from "./AgentDetailsModal";

export type AgentsDetailsProps = { agents: Agent[] };

export const AgentsDetails = ({ agents }: AgentsDetailsProps) => {
  const { search, setSearch } = useDashboardStore((s) => ({
    search: s.searchAgentsValue,
    setSearch: s.setSearchAgentsValue,
  }));

  const {
    openAgentDetailsModal,
    isAgentDetailsModalOpen,
    selectedAgent,
    closeAgentDetailsModal,
  } = useModalsStore((s) => ({
    openAgentDetailsModal: s.openAgentDetailsModal,
    isAgentDetailsModalOpen: s.isAgentDetailsModalOpen,
    selectedAgent: s.selectedAgent,
    closeAgentDetailsModal: s.closeAgentDetailsModal,
  }));

  const filteredList = useMemo(() => {
    if (!search) return agents;
    return agents.filter((agent) =>
      agent.identifier.toLowerCase().includes(search.toLowerCase()),
    );
  }, [agents, search]);

  const inputRef = useRef<HTMLInputElement>(null);

  if (!agents?.length) {
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

  // Render the list of agents
  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full relative px-3 gap-3">
        <div className="sticky top-0 z-10 flex-shrink-0 bg-[var(--color-bg-container)] py-2">
          <div className="flex items-center justify-between gap-3">
            <Card className="bg-background">
              <CardContent className="pt-6 grid gap-4 grid-cols-[70px_1px_70px_1px_200px]">
                <div className="flex-col items-start justify-center">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    Agents
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {agents.length}
                  </div>
                </div>
                <Separator
                  orientation="vertical"
                  className="bg-border h-auto"
                />
                <div className="flex-col items-start justify-center">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    Calls
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {agents.reduce(
                      (acc, agent) => acc + (agent.usage?.callCount || 0),
                      0,
                    )}
                  </div>
                </div>
                <Separator
                  orientation="vertical"
                  className="bg-border h-auto"
                />
                <div className="flex-col items-start justify-center">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    Last invocation
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {formatRelativeTime(
                      agents.reduce((latest, agent) => {
                        const lastCall = agent.usage?.lastCalledAt;
                        if (!lastCall) return latest;
                        const lastDate = new Date(lastCall).getTime();
                        return lastDate > latest ? lastDate : latest;
                      }, 0),
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex items-center focus-within:border-[var(--color-border-secondary)] focus-within:border-solid self-start">
              <Input
                className="bg-background shadow-none rounded-md border-[1px] border-[var(--color-border-interactive)] focus-visible:ring-0 placeholder:text-[var(--color-text-secondary)] font-normal text-sm h-7.5 w-[180px]"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                ref={inputRef}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      setSearch("");
                      inputRef.current?.focus();
                    }}
                    variant="vanilla"
                    className="background-transparent focus-visible:ring-0 hover:text-[var(--color-fg-interactive)] focus:text-[var(--color-fg-interactive)] focus-visible:bg-[var(--color-bg-container-overlay)] h-7 w-4 rounded-none"
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
            </div>
          </div>
        </div>
        {search && filteredList.length === 0 && (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center text-[var(--color-text-secondary)]">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No results found</p>
              <Button
                variant="secondary"
                size="sm"
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
          <Card
            key={`${agent.id}_${index}`}
            className={`mb-3 border-[var(--color-border-primary)] bg-[var(--color-bg-container-overlay)] rounded-md cursor-pointer hover:shadow-md transition-shadow ${isActive(agent.usage.lastCalledAt) ? "border-[var(--color-fg-success)] bg-[var(--color-bg-success)]" : ""}`}
            onClick={() => openAgentDetailsModal(agent)}
          >
            <CardHeader className="p-3 border-b border-[var(--color-border-primary)]">
              <CardTitle
                key={`${agent.id}_${index}`}
                className="text-lg flex justify-start items-center whitespace-nowrap font-bold text-[var(--color-text-primary)]] p-0 select-none gap-3 grid grid-cols-[minmax(min-content,_240px)_1fr] leading-8"
              >
                <span className="flex items-center whitespace-nowrap gap-1">
                  <User className="text-[var(--color-fg-interactive)]" />
                  <span className="truncate max-w-[240px] text-[var(--color-fg-interactive)]">
                    {agent.identifier}
                  </span>
                </span>
                <span className="font-semibold text-sm truncate max-w-[370px]">
                  Session ID: {agent.sessionIds?.[0] || "No session"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1.5">
              <div className="flex flex-col h-full relative">
                {/* <AgentControls agent={selectedAgent} /> */}
                <div className="grid grid-cols-3 gap-6 mb-2 ">
                  <div className="text-xs">
                    <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" />
                      Session
                    </h4>
                    <p className="flex items-center gap-1">
                      <span className="font-semibold">ID:</span>
                      <span className="truncate max-w-[120px] inline-block align-bottom select-all">
                        {agent.sessionIds?.[0] || "N/A"}
                      </span>
                    </p>
                    <span className="font-semibold">Status:</span>
                    <Badge
                      variant="outline"
                      className="capitalize ml-1 px-1 py-0 bg-[var(--color-bg-success)] text-[var(--color-fg-success)] border-[var(--color-border-success)]"
                    >
                      {agent.status}
                    </Badge>
                    <p className="flex items-center gap-1">
                      <span className="font-semibold">Last Activity:</span>
                      {formatDateTime(agent.lastActivity)}
                    </p>
                  </div>
                  {agent.llm && agent.llm.provider !== "unknown" && (
                    <div className="text-xs">
                      <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-0.5 flex items-center gap-1">
                        <Brain className="w-4 h-4" />
                        LLM
                      </h4>
                      <p className="flex items-center gap-1">
                        <span className="font-semibold">Provider:</span>
                        {agent.llm.provider}
                      </p>
                      <p className="flex items-center gap-1">
                        <span className="font-semibold">Model:</span>
                        <span className="truncate max-w-[120px] inline-block align-bottom">
                          {"model" in agent.llm
                            ? agent.llm.model
                            : agent.llm.modelId}
                        </span>
                      </p>
                    </div>
                  )}
                  {agent.usage && (
                    <div className="text-xs">
                      <h4 className="text-sm font-medium text-[var(--color-text-secondary)]  mb-0.5 flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        Usage
                      </h4>
                      <p className="flex items-center gap-1">
                        <span className="font-semibold">Calls:</span>
                        {agent.usage.callCount}
                      </p>
                      <p className="flex items-center gap-1">
                        <span className="font-semibold">Last Call:</span>
                        {formatDateTime(agent.usage.lastCalledAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Details Modal */}
      <AgentDetailsModal
        agent={selectedAgent || null}
        isOpen={isAgentDetailsModalOpen}
        onClose={closeAgentDetailsModal}
      />
    </DashboardScrollArea>
  );
};
