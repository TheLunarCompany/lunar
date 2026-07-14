import { ChevronRight, ListFilter, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import type {
  TargetServer,
  ToolExtensionParamsRecord,
} from "@mcpx/shared-model";
import type {
  CapabilityAnnotationFilterValue,
  CapabilityItem,
  CapabilityProvider,
} from "@/components/capabilities/types";
import { buildCapabilityProvidersFromCurrentTools } from "@/components/capabilities/current-tool-capabilities";
import {
  createCustomCapabilityTool,
  deleteCustomCapabilityTool,
  updateCustomCapabilityTool,
} from "@/components/capabilities/capability-actions";
import {
  CustomCapabilityToolDialog,
  type CustomCapabilityToolSubmitPayload,
} from "@/components/capabilities/CustomCapabilityToolDialog";
import { ServerStatusBadge } from "@/components/dashboard/ServerStatusBadge";
import { getMcpServerStatusFromTargetServer } from "@/components/dashboard/helpers";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { useServerInactive } from "@/hooks/useServerInactive";
import { Button, buttonVariants } from "@/components/ui/button";
import { MultiSelectFilterDropdown } from "@/components/ui/multi-select-filter-dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { toast, useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  McpServerPromptCard,
  McpServerToolCard,
} from "@/components/mcp-servers/McpServerCapabilityCards";
import { CapabilityItemDetailsDialog } from "@/components/capabilities/CapabilityItemDetailsDialog";
import { AuthenticationDialog } from "@/components/dashboard/AuthenticationDialog";
import { AuthenticationRequiredCard } from "@/components/dashboard/ServerStateCards";
import HammerIcon from "@/components/capabilities/icons/hammer.svg?react";
import PromptIcon from "@/components/capabilities/icons/prompt.svg?react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServerIconSvg from "@/icons/server_icon.svg?react";
import {
  TOOLTIP_HOVER_DELAY_MS,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInitiateServerAuth } from "@/data/server-auth";
import { routes } from "@/routes";
import { Link } from "react-router-dom";
import { useSocketStore } from "@/store";

type McpServersSectionProps = {
  servers: TargetServer[];
};

const ZERO_STATE_ICON_WIDTH = 126;
const ZERO_STATE_ICON_HEIGHT = 200;

const annotationFilterOptions: {
  value: CapabilityAnnotationFilterValue;
  label: string;
  dot: string;
}[] = [
  { value: "read-only", label: "Read-only", dot: "bg-green-500" },
  { value: "write", label: "Write", dot: "bg-amber-500" },
  { value: "destructive", label: "Destructive", dot: "bg-red-500" },
];

function AnnotationFilterDropdown({
  value,
  onChange,
}: {
  value: CapabilityAnnotationFilterValue[];
  onChange: (filter: CapabilityAnnotationFilterValue[]) => void;
}) {
  const selectedCount = value.length;
  const isAll = selectedCount === 0;

  return (
    <MultiSelectFilterDropdown
      options={annotationFilterOptions}
      getOptionValue={(option) => option.value}
      renderOption={(option) => (
        <>
          <span className={cn("size-1.5 rounded-full", option.dot)} />
          {option.label}
        </>
      )}
      selectedValues={value}
      onSelectedValuesChange={(values) =>
        onChange(values as CapabilityAnnotationFilterValue[])
      }
      allLabel="All"
      contentClassName="min-w-48 p-2"
      triggerClassName={buttonVariants({
        variant: "ghost",
        size: "sm",
        className: "cursor-pointer",
      })}
      triggerContent={
        <>
          <ListFilter className="mr-2 size-4" />
          Filter Tools
          {!isAll && (
            <span className="ml-1.5 text-xs text-[var(--colors-gray-500)]">
              ({selectedCount})
            </span>
          )}
        </>
      }
    />
  );
}

function buildOverrideParams(
  parameters: CustomCapabilityToolSubmitPayload["parameters"],
): ToolExtensionParamsRecord {
  return parameters.reduce<ToolExtensionParamsRecord>(
    (overrideParams, parameter) => {
      const value = parameter.value.trim();
      const description = parameter.description.trim();
      if (!value && !description) {
        return overrideParams;
      }

      const override: ToolExtensionParamsRecord[string] = {};
      if (value) {
        override.value = value;
      }
      if (description) {
        override.description = { action: "rewrite", text: description };
      }

      overrideParams[parameter.name] = override;
      return overrideParams;
    },
    {},
  );
}

function buildCustomToolParameters(item: CapabilityItem) {
  const properties = item.inputSchema?.properties;
  if (!properties || typeof properties !== "object") {
    return [];
  }

  return Object.entries(properties).map(([name, schema]) => {
    const record =
      typeof schema === "object" && schema !== null
        ? (schema as Record<string, unknown>)
        : {};
    const override = item.overrideParams?.[name];

    return {
      name,
      value:
        override?.value === undefined || override.value === null
          ? record.default === undefined || record.default === null
            ? ""
            : String(record.default)
          : String(override.value),
      description:
        override?.description?.text ??
        (typeof record.description === "string" ? record.description : ""),
    };
  });
}

function getServerStatusSortRank(server: TargetServer): number {
  switch (server.state.type) {
    case "connected":
    case "connecting":
      return 0;
    case "pending-input":
      return 1;
    case "pending-auth":
      return 2;
    case "connection-failed":
      return 3;
  }
}

function matchesAnnotationFilter(
  provider: CapabilityProvider,
  filters: CapabilityAnnotationFilterValue[],
): CapabilityProvider {
  if (filters.length === 0) {
    return provider;
  }

  return {
    ...provider,
    items: provider.items.filter((item) => {
      const annotations = item.annotations;
      if (!annotations) {
        return false;
      }

      return filters.some((filter) => {
        switch (filter) {
          case "read-only":
            return annotations.readOnlyHint === true;
          case "destructive":
            return annotations.destructiveHint === true;
          case "write":
            return !annotations.readOnlyHint && !annotations.destructiveHint;
        }
      });
    }),
  };
}

export function McpServersSection({ servers }: McpServersSectionProps) {
  const appConfig = useSocketStore((state) => state.appConfig);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedItem, setSelectedItem] = useState<CapabilityItem | null>(null);
  const [customDialogItem, setCustomDialogItem] =
    useState<CapabilityItem | null>(null);
  const [isSavingCustomTool, setIsSavingCustomTool] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [annotationFilter, setAnnotationFilter] = useState<
    CapabilityAnnotationFilterValue[]
  >([]);

  const sortedServers = useMemo(
    () =>
      [...servers].sort((a, b) => {
        const rankDiff =
          getServerStatusSortRank(a) - getServerStatusSortRank(b);
        if (rankDiff !== 0) {
          return rankDiff;
        }

        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
      }),
    [servers],
  );
  const capabilityProviders = useMemo<CapabilityProvider[]>(() => {
    const providers = buildCapabilityProvidersFromCurrentTools({
      targetServers: sortedServers,
      toolExtensionsServices: appConfig?.toolExtensions?.services,
    });
    const providersByName = new Map(
      providers.map((provider) => [provider.name, provider]),
    );

    return sortedServers.map(
      (server) =>
        providersByName.get(server.name) ?? {
          name: server.name,
          state: server.state,
          icon: server.icon,
          items: [],
        },
    );
  }, [appConfig?.toolExtensions?.services, sortedServers]);
  const visibleProviders = useMemo(() => {
    const searchQueryLower = searchQuery.trim().toLowerCase();
    // When a search or annotation filter is active, narrow to servers that
    // still have matching items. Without an active filter we keep every server,
    // including ones with no capabilities, so newly added servers stay visible.
    const isFiltering =
      searchQueryLower.length > 0 || annotationFilter.length > 0;

    return capabilityProviders
      .map((provider) => {
        if (!searchQueryLower) {
          return provider;
        }

        return {
          ...provider,
          items: provider.items.filter((item) =>
            item.name.toLowerCase().includes(searchQueryLower),
          ),
        };
      })
      .map((provider) => matchesAnnotationFilter(provider, annotationFilter))
      .filter((provider) => !isFiltering || provider.items.length > 0);
  }, [annotationFilter, capabilityProviders, searchQuery]);
  const serversByName = useMemo(
    () => new Map(sortedServers.map((server) => [server.name, server])),
    [sortedServers],
  );

  const handleServerClick = (serverName: string) => {
    setExpandedServers((current) => {
      const next = new Set(current);
      if (next.has(serverName)) {
        next.delete(serverName);
      } else {
        next.add(serverName);
      }
      return next;
    });
  };

  async function handleSubmitCustomTool(
    payload: CustomCapabilityToolSubmitPayload,
  ) {
    try {
      setIsSavingCustomTool(true);
      const overrideParams = buildOverrideParams(payload.parameters);

      if (payload.originalCustomCapabilityName) {
        await updateCustomCapabilityTool({
          providerName: payload.providerName,
          baseCapabilityName: payload.baseCapabilityName,
          customCapabilityName: payload.originalCustomCapabilityName,
          updates: {
            description: {
              action: "rewrite",
              text: payload.description,
            },
            overrideParams,
          },
        });
      } else {
        await createCustomCapabilityTool({
          providerName: payload.providerName,
          baseCapabilityName: payload.baseCapabilityName,
          customCapabilityTool: {
            name: payload.customCapabilityName,
            description: {
              action: "rewrite",
              text: payload.description,
            },
            overrideParams,
          },
        });
      }

      setCustomDialogItem(null);
      return true;
    } catch (error) {
      toast({
        title: "Failed to save custom tool",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSavingCustomTool(false);
    }
  }

  async function handleDeleteCustomItem(item: CapabilityItem) {
    if (!item.originalToolName) return;

    try {
      await deleteCustomCapabilityTool({
        providerName: item.providerName,
        baseCapabilityName: item.originalToolName,
        customCapabilityName: item.name,
      });
    } catch (error) {
      toast({
        title: "Failed to delete custom tool",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <>
      <h1 className="mb-5 text-[20px] font-semibold text-[#20222A]">
        MCP Servers
      </h1>

      {servers.length === 0 ? (
        <McpServersZeroState />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput
                placeholder="Search tools, prompts and resources"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                wrapperClassName="w-[320px] max-w-full"
                className="rounded-lg"
              />
              <AnnotationFilterDropdown
                value={annotationFilter}
                onChange={setAnnotationFilter}
              />
            </div>
            <Button asChild>
              <Link to={routes.mcpServerAdd}>
                <Plus className="size-4" />
                Add Server
              </Link>
            </Button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
            <h2 className="mb-5 text-base font-semibold text-[#20222A]">
              MCP Servers Catalog
            </h2>

            {visibleProviders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                No tools available.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleProviders.map((provider) => {
                  const server = serversByName.get(provider.name);
                  if (!server) {
                    return null;
                  }

                  return (
                    <McpServerRow
                      key={server.name}
                      server={server}
                      items={provider.items}
                      isExpanded={expandedServers.has(server.name)}
                      onClick={() => handleServerClick(server.name)}
                      onShowDetails={setSelectedItem}
                      onCustomizeItem={setCustomDialogItem}
                      onEditItem={setCustomDialogItem}
                      onDeleteItem={(item) => void handleDeleteCustomItem(item)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <CapabilityItemDetailsDialog
        isOpen={selectedItem !== null}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onCustomizeItem={(item) => {
          setSelectedItem(null);
          setCustomDialogItem(item);
        }}
        onEditItem={(item) => {
          setSelectedItem(null);
          setCustomDialogItem(item);
        }}
        onDeleteItem={(item) => {
          setSelectedItem(null);
          void handleDeleteCustomItem(item);
        }}
      />
      <CustomCapabilityToolDialog
        isOpen={!!customDialogItem}
        onOpenChange={(open) => !open && setCustomDialogItem(null)}
        onClose={() => setCustomDialogItem(null)}
        providers={capabilityProviders}
        preSelectedProviderName={customDialogItem?.providerName}
        preSelectedItemName={
          customDialogItem?.isCustom
            ? customDialogItem.originalToolName
            : customDialogItem?.name
        }
        preFilledData={
          customDialogItem?.isCustom
            ? {
                name: customDialogItem.name,
                description: customDialogItem.description,
                parameters: buildCustomToolParameters(customDialogItem),
              }
            : undefined
        }
        isLoading={isSavingCustomTool}
        onSubmitCustomCapabilityTool={handleSubmitCustomTool}
      />
    </>
  );
}

function McpServersZeroState() {
  return (
    <div className="flex flex-1 items-center justify-center pb-20">
      <div className="w-full rounded-lg border border-border bg-card p-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <ServerIconSvg
            width={ZERO_STATE_ICON_WIDTH}
            height={ZERO_STATE_ICON_HEIGHT}
          />
          <h2 className="text-xl font-semibold text-foreground">
            No Servers Found
          </h2>
          <Button asChild>
            <Link to={routes.mcpServerAdd}>Add Server</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function McpServerRow({
  server,
  items,
  isExpanded,
  onClick,
  onShowDetails,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
}: {
  server: TargetServer;
  items: CapabilityItem[];
  isExpanded: boolean;
  onClick: () => void;
  onShowDetails: (item: CapabilityItem) => void;
  onCustomizeItem: (item: CapabilityItem) => void;
  onEditItem: (item: CapabilityItem) => void;
  onDeleteItem: (item: CapabilityItem) => void;
}) {
  const domainIconUrl = useDomainIcon(server.name);
  const isInactive = useServerInactive(server.name);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);

  const PX_PER_MS = 0.8;
  const MIN_DURATION_MS = 80;
  const MAX_DURATION_MS = 420;
  const durationMs =
    lastHeightRef.current > 0
      ? Math.min(
          MAX_DURATION_MS,
          Math.max(MIN_DURATION_MS, lastHeightRef.current / PX_PER_MS),
        )
      : 120;

  useEffect(() => {
    if (!isExpanded || !contentRef.current) return;
    const el = contentRef.current;
    const onTransitionEnd = () => {
      const height = el.scrollHeight;
      if (height > 0) lastHeightRef.current = height;
    };
    el.addEventListener("transitionend", onTransitionEnd);
    return () => el.removeEventListener("transitionend", onTransitionEnd);
  }, [isExpanded]);

  const status = isInactive
    ? "disabled"
    : getMcpServerStatusFromTargetServer(server);

  const tools = useMemo(
    () => items.filter((item) => item.kind === "tool"),
    [items],
  );
  const prompts = useMemo(
    () => items.filter((item) => item.kind === "prompt"),
    [items],
  );

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-sm"
      data-server-name={server.name}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-5 px-4 py-3 text-left"
        onClick={onClick}
      >
        <div className="flex min-w-0 items-center gap-4">
          {domainIconUrl ? (
            <img
              src={domainIconUrl}
              alt={`${server.name} favicon`}
              className="size-6 shrink-0 object-contain"
              style={
                isInactive ? { filter: "grayscale(100%) brightness(0.8)" } : {}
              }
            />
          ) : (
            <div className="size-6 shrink-0 rounded bg-gray-100" />
          )}
          <span
            className={`truncate text-base font-semibold capitalize ${
              isInactive ? "text-[#C3C4CD]" : "text-gray-900"
            }`}
          >
            {server.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <ServerStatusBadge status={status} />
          <Metric icon={HammerIcon} label="Tools" value={server.tools.length} />
          <Metric
            icon={PromptIcon}
            label="Prompts"
            value={server.prompts?.length ?? 0}
          />
          <ChevronRight
            className={`size-4 text-gray-400 ${isExpanded ? "rotate-90" : ""}`}
            style={{
              transition: `transform ${durationMs}ms ease-out`,
            }}
          />
        </div>
      </button>

      <div
        className="grid ease-out"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: `grid-template-rows ${durationMs}ms ease-out`,
        }}
      >
        <div
          ref={contentRef}
          className="min-h-0 overflow-hidden border-t border-gray-100"
        >
          <div
            className="pb-4"
            style={{
              opacity: isExpanded ? 1 : 0,
              transform: isExpanded ? "translateY(0)" : "translateY(-6px)",
              transition: `opacity ${durationMs}ms ease-out, transform ${durationMs}ms ease-out`,
            }}
          >
            {server.state.type === "pending-auth" ? (
              <div className="p-4">
                <McpServerAuthenticationCard server={server} />
              </div>
            ) : (
              <Tabs defaultValue="tools" className="gap-0">
                <div className="border-b px-4 pt-3">
                  <TabsList variant="line" className="gap-3">
                    <TabsTrigger value="tools" className="px-0">
                      Tools
                      <TabCount value={tools.length} />
                    </TabsTrigger>
                    <TabsTrigger value="prompts" className="px-0">
                      Prompts
                      <TabCount value={prompts.length} />
                    </TabsTrigger>
                    <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-not-allowed">
                            <TabsTrigger
                              value="resources"
                              disabled
                              className="pointer-events-none px-0"
                            >
                              Resources
                            </TabsTrigger>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={8}>
                          Coming soon
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TabsList>
                </div>

                <TabsContent value="tools" className="mt-0">
                  <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tools.length > 0 ? (
                      tools.map((tool) => (
                        <McpServerToolCard
                          key={tool.id}
                          item={tool}
                          className="w-full"
                          onShowDetails={onShowDetails}
                          onCustomizeItem={onCustomizeItem}
                          onEditItem={onEditItem}
                          onDeleteItem={onDeleteItem}
                        />
                      ))
                    ) : (
                      <EmptyTabMessage>No tools available</EmptyTabMessage>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="prompts" className="mt-0">
                  <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {prompts.length > 0 ? (
                      prompts.map((prompt) => (
                        <McpServerPromptCard
                          key={prompt.id}
                          item={prompt}
                          className="w-full"
                          onShowDetails={onShowDetails}
                          onEditItem={onEditItem}
                          onDeleteItem={onDeleteItem}
                        />
                      ))
                    ) : (
                      <EmptyTabMessage>No prompts available</EmptyTabMessage>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function McpServerAuthenticationCard({ server }: { server: TargetServer }) {
  const { mutate: initiateServerAuth } = useInitiateServerAuth();
  const { toast: showToast, dismiss } = useToast();
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);

  function handleAuthenticate() {
    setIsAuthenticating(true);
    initiateServerAuth(
      { serverName: server.name },
      {
        onSuccess: ({ authorizationUrl, userCode: nextUserCode }) => {
          if (authorizationUrl) {
            const url = new URL(authorizationUrl).toString();
            const newAuthWindow = window.open(
              url,
              "mcpx-auth-popup",
              "width=600,height=700,popup=true",
            );

            if (newAuthWindow) {
              newAuthWindow.focus();
              setAuthWindow(newAuthWindow);
            } else {
              setIsAuthenticating(false);
              showToast({
                title: "Authentication Error",
                description:
                  "Failed to open authentication window. Please check your popup blocker settings.",
                variant: "destructive",
              });
            }
          } else {
            setIsAuthenticating(false);
            showToast({
              title: "Authentication Error",
              description: "No authorization URL received from server.",
              variant: "destructive",
            });
          }

          if (nextUserCode) {
            dismiss();
            setUserCode(nextUserCode);
          }
        },
        onError: (error) => {
          setIsAuthenticating(false);
          showToast({
            title: "Authentication Failed",
            description: `Failed to initiate authentication: ${error.message}`,
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <>
      <AuthenticationRequiredCard
        authWindow={authWindow}
        isAuthenticating={isAuthenticating}
        onAuthenticate={handleAuthenticate}
        setAuthWindow={setAuthWindow}
        setIsAuthenticating={setIsAuthenticating}
        setUserCode={setUserCode}
        userCode={userCode}
      />
      <AuthenticationDialog
        userCode={userCode}
        serverStatus={getMcpServerStatusFromTargetServer(server)}
        onClose={() => setUserCode(null)}
      />
    </>
  );
}

function TabCount({ value }: { value: number }) {
  return (
    <span className="grid size-4 place-items-center rounded-full border border-current text-[10px] leading-none">
      {value}
    </span>
  );
}

function EmptyTabMessage({ children }: { children: string }) {
  return (
    <div className="col-span-full py-8 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

type MetricProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
};

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600"
            aria-label={`${label}: ${value}`}
          >
            <Icon className="size-4 text-gray-400 [--fill-0:currentColor]" />
            {value}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="z-[9999]">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
