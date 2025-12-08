import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/tools/ProviderCard";
import { NoServersPlaceholder } from "@/components/tools/EmptyStatePlaceholders";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ToolsItem } from "@/types";
import { TargetServerNew } from "@mcpx/shared-model";
import { useMemo } from "react";
import React from "react";
import { useSocketStore } from "@/store";
import { isServerInactive } from "@/hooks/useServerInactive";

export interface Provider {
  name: string;
  state?: {
    type: string;
  };
  originalTools: Array<{
    name: string;
    description?: string;
    serviceName?: string;
    originalToolId?: string;
    originalToolName?: string;
    isCustom?: boolean;
  }>;
  tools: Tool[];
}

interface ToolsCatalogSectionProps {
  providers: TargetServerNew[];
  totalFilteredTools: number;
  selectedToolGroup: string | null;
  toolGroups: Array<{ id: string; name: string }>;
  expandedProviders: Set<string>;
  isEditMode: boolean;
  isAddCustomToolMode: boolean;
  selectedTools: Set<string>;
  searchQuery: string;
  onProviderClick: (providerName: string) => void;
  onToolSelectionChange: (
    tool: any,
    providerName: string,
    isSelected: boolean,
  ) => void;
  onSelectAllTools?: (providerName: string) => void;
  onEditClick: (tool: ToolsItem) => void;
  onDuplicateClick: (tool: ToolsItem) => void;
  onDeleteTool: (tool: ToolsItem) => void;
  onCustomizeTool: (tool: ToolsItem) => void;
  onToolClick: (tool: ToolsItem) => void;
  onAddServerClick: () => void;
  onShowAllTools: () => void;
  onAddCustomToolClick: () => void;
  onEditModeToggle: () => void;
  selectedToolForDetails?: any;
  recentlyCustomizedTools?: Set<string>;
  currentlyCustomizingTools?: Set<string>;
}

const styles = {
  header: "flex justify-between items-start gap-12 whitespace-nowrap mb-0",
  titleSection: "flex flex-col gap-2",
  filterInfo: "flex flex-wrap items-center gap-2 text-sm mb-2",
  filterBadge:
    "bg-[#4F33CC1A] text-[#4F33CC] px-2 py-1 rounded-full font-medium",
  searchTerm: "bg-gray-200 text-gray-700 px-2 py-1 rounded",
  editModeButton:
    "bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm",
};

function ToolsCatalogSectionComponent({
  providers,
  totalFilteredTools,
  selectedToolGroup,
  toolGroups,
  expandedProviders,
  isEditMode,
  isAddCustomToolMode,

  selectedTools,
  searchQuery,
  onProviderClick,
  onToolSelectionChange,
  onSelectAllTools,
  onEditClick,
  onDuplicateClick,
  onDeleteTool,
  onCustomizeTool,
  onToolClick,
  onAddServerClick,
  onShowAllTools,
  onAddCustomToolClick,
  onEditModeToggle,
  selectedToolForDetails,
  recentlyCustomizedTools,
  currentlyCustomizingTools,
}: ToolsCatalogSectionProps) {
  const { appConfig } = useSocketStore((s) => ({
    appConfig: s.appConfig,
  }));

  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      const isAInactive = isServerInactive(a.name, appConfig);
      const isBInactive = isServerInactive(b.name, appConfig);

      // Inactive servers go to the end
      if (isAInactive && !isBInactive) return 1;
      if (!isAInactive && isBInactive) return -1;

      // If both are inactive or both are active, sort by name
      const nameCompare = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      });

      const isAPending = a.state?.type === "pending-auth";
      const isBPending = b.state?.type === "pending-auth";

      // Pending auth goes after active but before inactive
      if (isAPending && !isBPending && !isAInactive && !isBInactive) return 1;
      if (!isAPending && isBPending && !isAInactive && !isBInactive) return -1;

      return nameCompare;
    });
  }, [providers, appConfig]);

  return (
    <>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedToolGroup
                  ? `Tools from "${toolGroups.find((g) => g.id === selectedToolGroup)?.name || "Selected Group"}"`
                  : "All Tools Catalog"}
              </h2>
              {selectedToolGroup && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onShowAllTools}
                  className="text-gray-600"
                >
                  Show All Tools
                </Button>
              )}
            </div>
            {searchQuery && totalFilteredTools > 0 && (
              <div className={styles.filterInfo}>
                <span className={styles.filterBadge}>
                  {totalFilteredTools} tool{totalFilteredTools !== 1 ? "s" : ""}{" "}
                  found
                </span>
                <span className={styles.searchTerm}>
                  Search: "{searchQuery}"
                </span>
              </div>
            )}
          </div>
        </div>

        {sortedProviders.length === 0 ? (
          <NoServersPlaceholder onAction={onAddServerClick} />
        ) : (
          <div className="space-y-3">
            {sortedProviders.map((provider) => (
              <ProviderCard
                key={provider.name}
                provider={provider}
                isExpanded={expandedProviders.has(provider.name)}
                isEditMode={isEditMode}
                isAddCustomToolMode={isAddCustomToolMode}
                selectedTools={selectedTools}
                onProviderClick={onProviderClick}
                onToolSelectionChange={onToolSelectionChange}
                onSelectAllTools={onSelectAllTools}
                handleEditClick={onEditClick}
                handleDuplicateClick={onDuplicateClick}
                handleDeleteTool={onDeleteTool}
                handleCustomizeTool={onCustomizeTool}
                onToolClick={onToolClick}
                selectedToolForDetails={selectedToolForDetails}
                recentlyCustomizedTools={recentlyCustomizedTools}
                currentlyCustomizingTools={currentlyCustomizingTools}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function areSetsEqual(set1: Set<string>, set2: Set<string>): boolean {
  if (set1.size !== set2.size) return false;
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
}

export const ToolsCatalogSection = ToolsCatalogSectionComponent;
