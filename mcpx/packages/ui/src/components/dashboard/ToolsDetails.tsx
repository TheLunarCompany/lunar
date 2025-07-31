import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { McpServer, Tool } from "@/types";
import { formatDateTime, isActive } from "@/utils";
import { CircleX, Clock, Server, Wrench } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { Combobox } from "../ui/combobox";
import { DashboardScrollArea } from "./DashboardScrollArea";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export type ToolsDetailsProps = {
  servers: McpServer[];
};

export const ToolsDetails = ({ servers }: ToolsDetailsProps) => {
  const [search, setSearch] = useState("");
  const [serversFilter, setServersFilter] = useState<string[]>([]);
  const [onlyUsed, setOnlyUsed] = useState(false);

  const filteredServers = useMemo(() => {
    if (!serversFilter.length) return servers;
    return servers.filter((server) =>
      serversFilter.some((s) =>
        server.name.toLowerCase().includes(s.toLowerCase()),
      ),
    );
  }, [servers, serversFilter]);

  const totalTools = useMemo(
    () => servers.reduce((acc, server) => acc + server.tools.length, 0),
    [servers],
  );

  const filteredTools: Tool[] = useMemo(
    () =>
      filteredServers
        .flatMap((server) => {
          return server.tools.map((tool) => ({
            name: tool.name,
            description: tool.description || "",
            invocations: tool.invocations,
            lastCalledAt: tool.lastCalledAt,
          }));
        })
        .filter((tool) =>
          tool.name.toLowerCase().includes(search.toLowerCase()),
        )
        .filter((tool) => {
          if (!onlyUsed) return true;
          return tool.invocations > 0;
        }),
    [filteredServers, onlyUsed, search],
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const clearFilters = () => {
    setSearch("");
    setServersFilter([]);
    setOnlyUsed(false);
  };

  if (!servers?.length) {
    return (
      <DashboardScrollArea>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center text-[var(--color-text-secondary)]">
            <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              No servers available. Please add a server to start using tools.
            </p>
          </div>
        </div>
      </DashboardScrollArea>
    );
  }

  if (!totalTools) {
    return (
      <div className="text-center p-20 text-[var(--color-text-secondary)]">
        <Wrench className="w-4 h-4 mx-auto mb-0.5 opacity-50" />
        No tools configured
      </div>
    );
  }

  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full relative px-3 gap-3">
        <div className="sticky top-0 z-10 flex-shrink-0 bg-[var(--color-bg-container)] py-2">
          <div className="flex items-start justify-between gap-3">
            <Card className="bg-background">
              <CardContent className="pt-6 grid gap-4 grid-cols-[120px_1px_120px]">
                <div className="flex-col items-start justify-center">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    Tools Available
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {totalTools}
                  </div>
                </div>
                <Separator
                  orientation="vertical"
                  className="bg-border h-auto"
                />
                <div className="flex-col items-start justify-center">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    Servers Available
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {servers.length}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-[1fr] gap-1.5">
              <div className="flex items-center focus-within:border-[var(--color-border-secondary)] focus-within:border-solid self-start">
                <Input
                  className="bg-background shadow-none rounded-md border-[1px] border-[var(--color-border-interactive)] focus-visible:ring-0 placeholder:text-[var(--color-text-secondary)] font-normal text-sm h-7.5 w-[180px]"
                  placeholder="Search tools..."
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
                      variant="icon"
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
              <div className="flex items-center focus-within:border-[var(--color-border-secondary)] focus-within:border-solid self-start rounded">
                <Combobox
                  autocompleteNoResultsText="No servers found"
                  autocompletePlaceholder="Search servers"
                  buttonLabel={
                    serversFilter.length
                      ? serversFilter.length > 1
                        ? `${serversFilter.length} selected`
                        : serversFilter[0]
                      : "Select servers"
                  }
                  buttonProps={{
                    className: `h-[30px] w-[180px] px-3 hover:text-[var(--color-text-primary)] focus:text-[var(--color-text-primary)] focus-visible:bg-[var(--color-bg-container-overlay)] border-[var(--color-border-interactive)] ${
                      serversFilter.length
                        ? " text-[var(--color-text-primary)]"
                        : " text-[var(--color-text-secondary)]"
                    }`,
                  }}
                  onChange={(values: string[]) => setServersFilter(values)}
                  options={servers.map((server) => ({
                    value: server.name,
                    label: server.name,
                  }))}
                  values={serversFilter}
                  multiple
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => {
                        setServersFilter([]);
                      }}
                      size="icon"
                      variant="vanilla"
                      className="focus-visible:ring-0 hover:text-[var(--color-fg-interactive)] focus:text-[var(--color-fg-interactive)] focus-visible:bg-[var(--color-bg-container-overlay)] h-7 w-4 rounded-none"
                    >
                      <CircleX />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    align="center"
                    className="shadow bg-[var(--color-bg-container)] text-[var(--color-fg-info)] text-xs"
                  >
                    Clear servers
                  </TooltipContent>
                </Tooltip>
              </div>
              <Label className="bg-background hover:bg-accent/50 flex items-center justify-between gap-3 px-3 py-1 rounded-md cursor-pointer border border-[var(--color-border-interactive)] text-[var(--color-text-secondary)] has-[[aria-checked=true]]:text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] w-[180px]">
                <span className="text-sm">Only used tools</span>
                <Checkbox checked={onlyUsed} onCheckedChange={setOnlyUsed} />
              </Label>
            </div>
          </div>
        </div>

        {(serversFilter.length || search || onlyUsed) &&
          filteredTools.length === 0 && (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center text-[var(--color-text-secondary)]">
                <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No results found</p>
                <Button
                  variant="outline"
                  size="xs"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:hover:bg-background disabled:hover:text-[var(--color-fg-interactive)] disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background shadow-sm hover:text-accent-foreground text-[9px] px-1 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] mt-4 hover:bg-[var(--color-bg-container-overlay)] text-[var(--color-text-secondary)] text-sm px-2 py-1"
                  onClick={clearFilters}
                >
                  <CircleX className="w-3 h-3 text-[var(--color-fg-interactive)] cursor-pointer" />
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

        {filteredTools.map((tool, index) => {
          const isToolActive: boolean = isActive(tool.lastCalledAt);
          return (
            <div
              key={index}
              className={`flex items-start justify-between p-3 rounded-md shadow border mb-1 ${
                !isToolActive && tool.invocations > 0
                  ? "bg-[var(--color-bg-warning)] border-[var(--color-border-warning)]"
                  : "bg-[var(--color-bg-container-overlay)] border-[var(--color-border-info)]"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <h5 className="font-medium text-lg text-[var(--color-text-primary)]">
                    {tool.name}
                  </h5>
                  {!isToolActive && tool.invocations > 0 && (
                    <Clock className="w-2.5 h-2.5 text-[var(--color-fg-warning)]" />
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-tight mb-0.5 whitespace-pre-wrap max-w-[100%]">
                  {tool.description}
                </p>
                <p className="text-xs text-[var(--color-text-primary)]">
                  Last called: {formatDateTime(tool.lastCalledAt)}
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-sm px-1 py-0 ml-1 bg-[var(--color-bg-container)] border-[var(--color-border-primary)] text-[var(--color-text-secondary)] whitespace-nowrap"
              >
                {tool.invocations} calls
              </Badge>
            </div>
          );
        })}
      </div>
    </DashboardScrollArea>
  );
};
