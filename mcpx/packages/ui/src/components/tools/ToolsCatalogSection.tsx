import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/tools/ProviderCard";
import {
  NoServersPlaceholder,
  NoToolsFoundPlaceholder,
} from "@/components/tools/EmptyStatePlaceholders";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ToolsItem } from "@/types";
import { RemoteTargetServer } from "@mcpx/shared-model";

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
  providers: RemoteTargetServer[];
  totalFilteredTools: number;
  selectedToolGroup: string | null;
  toolGroups: Array<{ id: string; name: string }>;
  expandedProviders: Set<string>;
  isEditMode: boolean;
  selectedTools: Set<string>;
  searchQuery: string;
  onProviderClick: (providerName: string) => void;
  onToolSelectionChange: (
    toolName: string,
    providerName: string,
    isSelected: boolean,
  ) => void;
  onEditClick: (tool: ToolsItem) => void;
  onDuplicateClick: (tool: ToolsItem) => void;
  onDeleteTool: (tool: ToolsItem) => void;
  onCustomizeTool: (tool: ToolsItem) => void;
  onToolClick: (tool: ToolsItem) => void;
  onAddServerClick: () => void;
  onShowAllTools: () => void;
  onAddCustomToolClick: () => void;
  onEditModeToggle: () => void;
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

export function ToolsCatalogSection({
  providers,
  totalFilteredTools,
  selectedToolGroup,
  toolGroups,
  expandedProviders,
  isEditMode,
  selectedTools,
  searchQuery,
  onProviderClick,
  onToolSelectionChange,
  onEditClick,
  onDuplicateClick,
  onDeleteTool,
  onCustomizeTool,
  onToolClick,
  onAddServerClick,
  onShowAllTools,
  onAddCustomToolClick,
  onEditModeToggle,
}: ToolsCatalogSectionProps) {

  return (
    <>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className="flex items-center justify-between mb-6 " >
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedToolGroup
                ? `Tools from "${toolGroups.find((g) => g.id === selectedToolGroup)?.name || "Selected Group"}"`
                : "All Tools"}
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
              <span className={styles.searchTerm}>Search: "{searchQuery}"</span>
            </div>
          )}
        </div>

      </div>

      {providers.length === 0 ? (
        <NoServersPlaceholder onAction={onAddServerClick} />
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.name}
              provider={provider}
              isExpanded={expandedProviders.has(provider.name)}
              isEditMode={isEditMode}
              selectedTools={selectedTools}
              onProviderClick={onProviderClick}
              onToolSelectionChange={onToolSelectionChange}
              handleEditClick={onEditClick}
              handleDuplicateClick={onDuplicateClick}
              handleDeleteTool={onDeleteTool}
              handleCustomizeTool={onCustomizeTool}
              onToolClick={onToolClick}
            />
          ))}
        </div>
      )}
      </div>
    </>
  );
}
