import { Button } from "@/components/ui/button";
import {
  ProviderCard,
  ToolSelectionItem,
} from "@/components/tools/ProviderCard";
import { NoServersPlaceholder } from "@/components/tools/EmptyStatePlaceholders";
import { ToolCardTool } from "@/components/tools/ToolCard";
import { TargetServer } from "@mcpx/shared-model";
import { useMemo } from "react";

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
  tools: ToolSelectionItem[];
}

interface ToolsCatalogSectionProps {
  providers: TargetServer[];
  totalFilteredTools: number;
  selectedToolGroup: string | null;
  toolGroups: Array<{ id: string; name: string }>;
  expandedProviders: Set<string>;
  /** Provider names marked inactive (shown last in sort). */
  inactiveProviderNames?: Set<string>;
  isEditMode: boolean;
  isAddCustomToolMode: boolean;
  selectedTools: Set<string>;
  searchQuery: string;
  onProviderClick: (providerName: string) => void;
  onToolSelectionChange: (
    tool: ToolSelectionItem,
    providerName: string,
    isSelected: boolean,
  ) => void;
  onSelectAllTools?: (providerName: string) => void;
  onEditClick: (tool: ToolCardTool) => void;
  onDuplicateClick: (tool: ToolCardTool) => void;
  onDeleteTool: (tool: ToolCardTool) => void;
  onCustomizeTool: (tool: ToolCardTool) => void;
  onToolClick: (tool: ToolCardTool) => void;
  onAddServerClick: () => void;
  onShowAllTools: () => void;
  onAddCustomToolClick: () => void;
  onEditModeToggle: () => void;
  selectedToolForDetails?: ToolCardTool;
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
  inactiveProviderNames,
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
  selectedToolForDetails,
  recentlyCustomizedTools,
  currentlyCustomizingTools,
}: ToolsCatalogSectionProps) {
  // Sort: connected (0) → pending (1) → error (2) → inactive (3); then by name
  const sortedProviders = useMemo(() => {
    const statusRank = (p: TargetServer) => {
      if (inactiveProviderNames?.has(p.name)) return 3; // Inactive last
      const t = p.state?.type;
      if (t === "connection-failed") return 2; // Error
      if (t === "pending-auth" || t === "pending-input") return 1; // Pending
      return 0; // connected or other
    };
    return [...providers].sort((a, b) => {
      const rankA = statusRank(a);
      const rankB = statusRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [providers, inactiveProviderNames]);

  return (
    <>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <div className="flex items-center justify-between pb-4">
              <p
                className="font-semibold"
                style={{ color: "#231A4D", fontSize: "16px" }}
              >
                {selectedToolGroup
                  ? `Tools from "${toolGroups.find((g) => g.id === selectedToolGroup)?.name || "Selected Group"}"`
                  : "Tool Catalog"}
              </p>
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

export const ToolsCatalogSection = ToolsCatalogSectionComponent;
