import { ChevronRight } from "lucide-react";
import { ToolCard, ToolCardTool } from "@/components/tools/ToolCard";
import { useMemo, useRef, useEffect } from "react";
import { TargetServer } from "@mcpx/shared-model";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { Button } from "@/components/ui/button";
import { useServerInactive } from "@/hooks/useServerInactive";
import { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolAnnotations } from "@/types";
import { ServerStatusBadge } from "@/components/dashboard/ServerStatusBadge";
import { getMcpServerStatusFromTargetServer } from "@/components/dashboard/helpers";

export type ToolSelectionItem = {
  isCustom: boolean;
  name?: string;
  description?: string;
  inputSchema?: McpTool["inputSchema"];
  serviceName?: string;
  originalToolId?: string;
  originalToolName?: string;
  overrideParams?: Record<string, { value: string }>;
  annotations?: ToolAnnotations;
};

interface ProviderCardProps {
  provider: TargetServer;
  isExpanded: boolean;
  isEditMode: boolean;
  isAddCustomToolMode: boolean;
  selectedTools: Set<string>;
  onProviderClick: (providerName: string) => void;
  onToolSelectionChange: (
    tool: ToolSelectionItem,
    providerName: string,
    isSelected: boolean,
  ) => void;
  onSelectAllTools?: (providerName: string) => void;
  handleEditClick: (tool: ToolCardTool) => void;
  handleDuplicateClick: (tool: ToolCardTool) => void;
  handleDeleteTool: (tool: ToolCardTool) => void;
  handleCustomizeTool: (tool: ToolCardTool) => void;
  onToolClick?: (tool: ToolCardTool) => void;
  selectedToolForDetails?: ToolCardTool;
  recentlyCustomizedTools?: Set<string>;
  currentlyCustomizingTools?: Set<string>;
  isDisabled?: boolean;
}

export function ProviderCard({
  provider,
  isExpanded,
  isEditMode,
  selectedTools,
  isAddCustomToolMode,
  onProviderClick,
  onToolSelectionChange,
  onSelectAllTools,
  handleDeleteTool,
  handleCustomizeTool,
  onToolClick,
  selectedToolForDetails,
  recentlyCustomizedTools,
  currentlyCustomizingTools,
  isDisabled,
}: ProviderCardProps) {
  const domainIconUrl = useDomainIcon(provider.name);
  const isServerInactive = useServerInactive(provider.name);
  const isInactive = isDisabled ?? isServerInactive;
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
      : 120; // default for first expand before we've measured

  useEffect(() => {
    if (!isExpanded || !contentRef.current) return;
    const el = contentRef.current;
    const onTransitionEnd = () => {
      const h = el.scrollHeight;
      if (h > 0) lastHeightRef.current = h;
    };
    el.addEventListener("transitionend", onTransitionEnd);
    return () => el.removeEventListener("transitionend", onTransitionEnd);
  }, [isExpanded]);

  const tools: ToolSelectionItem[] = useMemo(
    () =>
      provider.originalTools
        .filter((tool) => tool?.name)
        .map((originalTool) => {
          const { name, ...rest } = originalTool;
          const tool = provider.tools.find((t) => t.name === name);
          // isCustom may exist on custom tools merged into originalTools by useToolCatalog
          // (see baseProviders in useToolCatalog.tsx for the type lie)
          const isCustom = "isCustom" in originalTool && originalTool.isCustom;
          return {
            ...(tool ?? {}),
            ...rest,
            name: name,
            isCustom: Boolean(isCustom),
            serviceName: provider.name,
          };
        }),
    [provider.originalTools, provider.tools, provider.name],
  );

  const allToolKeys = useMemo(
    () => provider.originalTools.map((tool) => `${provider.name}:${tool.name}`),
    [provider.originalTools, provider.name],
  );

  const allSelected = useMemo(
    () => allToolKeys.every((toolKey) => selectedTools.has(toolKey)),
    [allToolKeys, selectedTools],
  );

  const status = isInactive
    ? "disabled"
    : getMcpServerStatusFromTargetServer(provider);

  return (
    <div
      className="bg-mcpx-surface rounded-lg border border-mcpx-border-subtle hover:shadow-[var(--mcpx-shadow-moderate)] transition-shadow"
      data-provider-name={provider.name}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => onProviderClick(provider.name)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={domainIconUrl}
              alt={`${provider.name} favicon`}
              className="w-8 h-8 object-contain"
              style={
                isInactive ? { filter: "grayscale(100%) brightness(0.8)" } : {}
              }
            />

            <div>
              <h3
                className={`font-semibold capitalize text-lg ${
                  isInactive ? "text-mcpx-text-disabled" : "text-mcpx-text"
                }`}
              >
                {provider.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Badge */}
            <ServerStatusBadge status={status} />

            {/* Select All/Deselect All Button - only show when creating/editing tool group and provider is connected and not inactive */}
            {isEditMode &&
              !isAddCustomToolMode &&
              provider.state?.type === "connected" &&
              !isInactive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 text-mcpx-selected hover:text-mcpx-selected hover:bg-mcpx-selected/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAllTools?.(provider.name);
                  }}
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </Button>
              )}

            {/* Usage Count */}
            <span
              className={`text-sm ${isInactive ? "text-mcpx-text-disabled" : "text-mcpx-text-secondary"}`}
            >
              {provider.originalTools.length} tools
            </span>

            {/* Dropdown Arrow */}
            <ChevronRight
              className={`w-5 h-5 text-mcpx-text-disabled ${isExpanded ? "rotate-90" : ""}`}
              style={{
                transition: `transform ${durationMs}ms ease-out`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Content - duration scales with height so animation speed is consistent */}
      <div
        className="grid ease-out"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: `grid-template-rows ${durationMs}ms ease-out`,
        }}
      >
        <div
          ref={contentRef}
          className="min-h-0 overflow-hidden border-t border-mcpx-border-subtle"
        >
          <div
            className="px-4 pb-4 pt-4"
            style={{
              opacity: isExpanded ? 1 : 0,
              transform: isExpanded ? "translateY(0)" : "translateY(-6px)",
              transition: `opacity ${durationMs}ms ease-out, transform ${durationMs}ms ease-out`,
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tools.length > 0 ? (
                tools
                  .filter((tool) => tool?.name)
                  .map((tool, index) => {
                    if (!tool.name) return null;
                    // Create a ToolCardTool with required name (we know it exists from check above)
                    const toolCardTool: ToolCardTool = {
                      name: tool.name,
                      description: tool.description,
                      inputSchema: tool.inputSchema,
                      isCustom: tool.isCustom,
                      originalToolName: tool.originalToolName,
                      originalToolId: tool.originalToolId,
                      serviceName: tool.serviceName,
                      annotations: tool.annotations,
                    };
                    const toolKey = `${provider.name}:${tool.name}`;
                    const isCustom = tool.isCustom ? "custom" : "original";
                    const originalToolId = tool.originalToolId || "";
                    const originalToolName = tool.originalToolName || "";
                    const uniqueKey = `${provider.name}:${tool.name}:${isCustom}:${originalToolId}:${originalToolName}:${index}`;
                    const isSelected = selectedTools.has(toolKey);
                    const selectionLocked =
                      isAddCustomToolMode &&
                      selectedTools.size > 0 &&
                      !isSelected;
                    return (
                      <div key={uniqueKey} className="w-full">
                        <ToolCard
                          tool={toolCardTool}
                          isEditMode={isEditMode}
                          isAddCustomToolMode={isAddCustomToolMode}
                          isSelected={isSelected}
                          selectionLocked={selectionLocked}
                          onToggleSelection={() => {
                            const isCurrentlySelected =
                              selectedTools.has(toolKey);
                            onToolSelectionChange(
                              tool,
                              provider.name,
                              !isCurrentlySelected,
                            );
                          }}
                          onToolClick={
                            onToolClick
                              ? () => onToolClick(toolCardTool)
                              : undefined
                          }
                          onCustomizeTool={handleCustomizeTool}
                          onDeleteTool={handleDeleteTool}
                          isDrawerOpen={
                            selectedToolForDetails &&
                            selectedToolForDetails.name === tool.name &&
                            selectedToolForDetails.serviceName === provider.name
                          }
                          triggerLoading={
                            recentlyCustomizedTools?.has(
                              `${provider.name}:${tool.name}`,
                            ) || false
                          }
                          isCustomizing={
                            currentlyCustomizingTools?.has(
                              `${provider.name}:${tool.name}`,
                            ) || false
                          }
                          isInactive={isInactive}
                        />
                      </div>
                    );
                  })
                  .filter(Boolean)
              ) : (
                <div className="col-span-full text-center py-8 text-mcpx-text-tertiary text-sm">
                  No tools available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
