import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { useDeleteMcpServer } from "@/data/mcp-server";
import { socketStore, useDashboardStore, useModalsStore } from "@/store";
import { McpServer, Tool } from "@/types";
import { formatDateTime, formatRelativeTime, isActive } from "@/utils";
import {
  Activity,
  AlertCircle,
  ChevronsUpDown,
  CircleX,
  Edit,
  Server,
  Unlink,
  Wrench,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { DashboardScrollArea } from "./DashboardScrollArea";

export type McpServersDetailsProps = {
  servers: McpServer[];
};

export const McpServersDetails = ({ servers }: McpServersDetailsProps) => {
  const { openEditServerModal } = useModalsStore((s) => ({
    openEditServerModal: s.openEditServerModal,
  }));

  const { mutate: deleteServer } = useDeleteMcpServer();

  const { search, setSearch } = useDashboardStore((s) => ({
    search: s.searchServersValue,
    setSearch: s.setSearchServersValue,
  }));

  const filteredList = useMemo(() => {
    if (!search) return servers;
    return servers.filter((server) =>
      server.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [servers, search]);

  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  if (!servers?.length) {
    return (
      <DashboardScrollArea>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center text-[var(--color-text-secondary)]">
            <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No servers connected</p>
          </div>
        </div>
      </DashboardScrollArea>
    );
  }

  const handleRemoveServer = (name: string) => {
    if (window.confirm("Are you sure you want to remove this server?")) {
      deleteServer(
        {
          name,
        },
        {
          onSuccess: () => {
            toast({
              title: "Server Removed",
              description: `Server "${name}" was removed successfully.`,
            });
          },
          onError: (error) => {
            toast({
              title: "Error",
              description: `Failed to remove server "${name}": ${error.message}`,
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full relative px-3 gap-3">
        <div className="sticky top-0 z-10 flex-shrink-0 bg-[var(--color-bg-container)] py-2">
          <div className="flex items-center justify-between gap-3">
            <Card className="bg-background">
              <CardContent className="pt-6 grid gap-4 grid-cols-[70px_1px_70px_1px_200px]">
                <div className="flex-col items-start justify-center">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    Servers
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {servers.length}
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
                    {servers.reduce(
                      (acc, server) => acc + (server.usage?.callCount || 0),
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
                      servers.reduce((latest, server) => {
                        const lastCall = server.usage?.lastCalledAt;
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
                placeholder="Search servers..."
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
              <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No results found</p>
              <Button
                variant="outline"
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

        {filteredList.map((server, index) => (
          <Collapsible key={`${server.name}_${index}`} className="mb-2">
            <Card
              className={`border-[var(--color-border-primary)] bg-[var(--color-bg-container-overlay)] rounded-md ${
                server.status === "connection_failed"
                  ? "border-[var(--color-fg-danger)] bg-[var(--color-bg-danger)]"
                  : isActive(server.usage.lastCalledAt)
                    ? "border-[var(--color-fg-success)] bg-[var(--color-bg-success)]"
                    : ""
              }`}
            >
              <CardHeader className="p-3 border-b border-[var(--color-border-primary)]">
                <div className="grid grid-cols-[minmax(min-content,_240px)_minmax(min-content,_240px)_1fr] gap-3 items-center leading-8">
                  <CardTitle className="text-lg font-bold text-[var(--color-fg-interactive)] flex items-center gap-1 leading-8">
                    <span className="inline-flex justify-center w-6 text-[var(--color-fg-interactive)]">
                      {server.icon}
                    </span>
                    {server.name}
                    {server.status === "connection_failed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[var(--color-bg-danger)] text-[var(--color-fg-danger)] rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </CardTitle>
                  <div className="font-semibold text-xs text-[var(--color-text-primary)] whitespace-nowrap">
                    {server.usage && (
                      <>
                        <span>Calls: {server.usage.callCount} | </span>
                        <span>
                          Last Active:
                          {formatDateTime(server.usage.lastCalledAt)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 min-w-[240px] justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const s = (socketStore
                          .getState()
                          .systemState?.targetServers.find(
                            ({ name }) => name === server.name,
                          ) ||
                          socketStore
                            .getState()
                            .systemState?.targetServers_new.find(
                              ({ name }) => name === server.name,
                            )) as any;
                        openEditServerModal(s);
                      }}
                      className="w-full max-w-[120px] px-1 py-0.5 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
                    >
                      <Edit className="w-2 h-2 mr-0.5" />
                      Edit
                    </Button>
                    <Button
                      className="w-full max-w-[120px] px-1 py-0.5 border-[var(--color-border-danger)] text-[var(--color-fg-danger)] hover:text-[var(--color-fg-danger)] hover:bg-[var(--color-bg-danger-hover)]"
                      variant="outline"
                      onClick={() => handleRemoveServer(server.name)}
                      size="sm"
                    >
                      <Unlink className="w-2 h-2 mr-0.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto space-y-1.5 p-3">
                {server.status === "connection_failed" &&
                  server.connectionError && (
                    <div className="mb-3 p-2 bg-[var(--color-bg-danger)] border border-[var(--color-border-danger)] rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[var(--color-fg-danger)] text-sm">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">Connection Error:</span>
                          <span>{server.connectionError}</span>
                        </div>
                      </div>
                    </div>
                  )}
                <div>
                  <h4 className="font-medium text-sm text-[var(--color-text-primary)] mb-1 flex items-center gap-1">
                    <Activity className="w-4 h-4" />
                    {server.tools?.length || 0} tools available
                    <div className="flex items-center justify-between gap-4 px-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <ChevronsUpDown />
                          <span className="sr-only">Toggle</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </h4>
                  <CollapsibleContent className="rounded-b-sm overflow-hidden">
                    {server.tools ? (
                      server.tools.map((tool: Tool, index: number) => (
                        <div
                          key={`${tool.name}_${index}`}
                          className="flex items-start justify-between p-1.5 border-l bg-[var(--color-bg-container-overlay)] border-[var(--color-border-info)]"
                        >
                          <div className="flex-1">
                            <div className="flex items-center">
                              <h5 className="font-medium text-[11px] text-[var(--color-text-primary)]">
                                {tool.name}
                              </h5>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-2 text-[var(--color-text-secondary)]">
                        <Wrench className="w-4 h-4 mx-auto mb-0.5 opacity-50" />
                        <p className="text-[10px]">No tools configured</p>
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </CardContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </DashboardScrollArea>
  );
};
