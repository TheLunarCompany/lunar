import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { McpServer, McpServerTool } from "@/types";
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

  const filteredTools: McpServerTool[] = useMemo(
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
          <div className="text-center text-(--color-text-secondary)">
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
      <div className="text-center p-20 text-(--color-text-secondary)">
        <Wrench className="w-4 h-4 mx-auto mb-0.5 opacity-50" />
        No tools configured
      </div>
    );
  }

  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full relative px-3 gap-3">
        <div className="sticky top-0 z-10 shrink-0 bg-(--color-bg-container) py-2">
          <div className="flex items-start justify-between gap-3">
            <Card className="bg-background">
              <CardContent className="pt-6 grid gap-4 grid-cols-[120px_1px_120px]">
                <div className="flex-col items-start justify-center">
                  <div className="text-sm font-medium text-(--color-text-primary)">
                    Tools Available
                  </div>
                  <div className="text-2xl font-bold text-(--color-text-primary)">
                    {totalTools}
                  </div>
                </div>
                <Separator
                  orientation="vertical"
                  className="bg-border h-auto"
                />
                <div className="flex-col items-start justify-center">
                  <div className="text-sm font-medium text-(--color-text-primary)">
                    Servers Available
                  </div>
                  <div className="text-2xl font-bold text-(--color-text-primary)">
                    {servers.length}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-[1fr] gap-1.5">
              <div className="flex items-center focus-within:border-(--color-border-secondary) focus-within:border-solid self-start">
                <Input
                  className="bg-background shadow-none rounded-md border border-(--color-border-interactive) focus-visible:ring-0 placeholder:text-(--color-text-secondary) font-normal text-sm h-7.5 w-[180px]"
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
                      variant="vanilla"
                      className="background-transparent focus-visible:ring-0 hover:text-(--color-fg-interactive) focus:text-(--color-fg-interactive) focus-visible:bg-(--color-bg-container-overlay) h-7 w-4 rounded-none"
                    >
                      <CircleX />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    align="center"
                    className="shadow-sm bg-(--color-bg-container) text-(--color-fg-info) text-xs"
                  >
                    Clear search
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center focus-within:border-(--color-border-secondary) focus-within:border-solid self-start rounded">
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
                    className: `h-[30px] w-[180px] px-3 hover:text-(--color-text-primary) focus:text-(--color-text-primary) focus-visible:bg-(--color-bg-container-overlay) border-(--color-border-interactive) ${
                      serversFilter.length
                        ? " text-(--color-text-primary)"
                        : " text-(--color-text-secondary)"
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
                      variant="vanilla"
                      className="focus-visible:ring-0 hover:text-(--color-fg-interactive) focus:text-(--color-fg-interactive) focus-visible:bg-(--color-bg-container-overlay) h-7 w-4 rounded-none"
                    >
                      <CircleX />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    align="center"
                    className="shadow-sm bg-(--color-bg-container) text-(--color-fg-info) text-xs"
                  >
                    Clear servers
                  </TooltipContent>
                </Tooltip>
              </div>
              <Label className="bg-background hover:bg-accent/50 flex items-center justify-between gap-3 px-3 py-1 rounded-md cursor-pointer border border-(--color-border-interactive) text-(--color-text-secondary) has-aria-checked:text-(--color-text-primary) hover:text-(--color-text-primary) w-[180px]">
                <span className="text-sm">Only used tools</span>
                <Checkbox
                  checked={onlyUsed}
                  onCheckedChange={(checked) => setOnlyUsed(checked === true)}
                />
              </Label>
            </div>
          </div>
        </div>

        {(serversFilter.length || search || onlyUsed) &&
          filteredTools.length === 0 && (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center text-(--color-text-secondary)">
                <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No results found</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:hover:bg-background disabled:hover:text-(--color-fg-interactive) disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background shadow-xs hover:text-accent-foreground text-[9px] px-1 py-0.5 border-(--color-border-interactive) text-(--color-fg-interactive) hover:bg-(--color-bg-interactive-hover) mt-4 hover:bg-(--color-bg-container-overlay) text-(--color-text-secondary) text-sm px-2 py-1"
                  onClick={clearFilters}
                >
                  <CircleX className="w-3 h-3 text-(--color-fg-interactive) cursor-pointer" />
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
                  ? "bg-(--color-bg-warning) border-(--color-border-warning)"
                  : "bg-(--color-bg-container-overlay) border-(--color-border-info)"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <h5 className="font-medium text-lg text-(--color-text-primary)">
                    {tool.name}
                  </h5>
                  {!isToolActive && tool.invocations > 0 && (
                    <Clock className="w-2.5 h-2.5 text-(--color-fg-warning)" />
                  )}
                </div>
                <p className="text-sm text-(--color-text-secondary) leading-tight mb-0.5 whitespace-pre-wrap max-w-full">
                  {tool.description}
                </p>
                <p className="text-xs text-(--color-text-primary)">
                  Last called: {formatDateTime(tool.lastCalledAt)}
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-sm px-1 py-0 ml-1 bg-(--color-bg-container) border-(--color-border-primary) text-(--color-text-secondary) whitespace-nowrap"
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
