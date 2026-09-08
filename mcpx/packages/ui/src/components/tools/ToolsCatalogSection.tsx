import { Button, buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { MultiSelectFilterDropdown } from "@/components/ui/multi-select-filter-dropdown";
import { ListFilter } from "lucide-react";
import {
  ProviderCard,
  ToolSelectionItem,
} from "@/components/tools/ProviderCard";
import { NoServersPlaceholder } from "@/components/tools/EmptyStatePlaceholders";
import { ToolCardTool } from "@/components/tools/ToolCard";
import { TargetServer } from "@mcpx/shared-model";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import type { AnnotationFilterValue } from "./annotation-filter";

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
  selectedToolGroup: string | null;
  toolGroups: Array<{ id: string; name: string }>;
  expandedProviders: Set<string>;
  /** Provider names marked inactive (shown last in sort). */
  inactiveProviderNames?: Set<string>;
  isEditMode: boolean;
  isAddCustomToolMode: boolean;
  selectedTools: Set<string>;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  annotationFilter: AnnotationFilterValue[];
  onAnnotationFilterChange: (filter: AnnotationFilterValue[]) => void;
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

const ANNOTATION_FILTER_OPTIONS: {
  value: AnnotationFilterValue;
  label: string;
  dot?: string;
}[] = [
  { value: "read-only", label: "Read-only", dot: "bg-green-500" },
  { value: "write", label: "Write", dot: "bg-amber-500" },
  { value: "destructive", label: "Destructive", dot: "bg-red-500" },
];

function AnnotationFilterDropdown({
  value,
  onChange,
}: {
  value: AnnotationFilterValue[];
  onChange: (v: AnnotationFilterValue[]) => void;
}) {
  const selectedCount = value.length;
  const isAll = selectedCount === 0;

  return (
    <MultiSelectFilterDropdown
      options={ANNOTATION_FILTER_OPTIONS}
      getOptionValue={(option) => option.value}
      renderOption={(option) => (
        <>
          <span className={cn("size-1.5 rounded-full", option.dot)} />
          {option.label}
        </>
      )}
      selectedValues={value}
      onSelectedValuesChange={(values) =>
        onChange(values as AnnotationFilterValue[])
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
          Filter
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

const styles = {
  header: "flex justify-between items-start gap-12 whitespace-nowrap mb-0",
  titleSection: "flex flex-col gap-2",
  editModeButton:
    "bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm",
};

function ToolsCatalogSectionComponent({
  providers,
  selectedToolGroup,
  toolGroups,
  expandedProviders,
  inactiveProviderNames,
  isEditMode,
  isAddCustomToolMode,
  selectedTools,
  searchQuery,
  onSearchQueryChange,
  annotationFilter,
  onAnnotationFilterChange,
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
      <div className="bg-white rounded-lg p-6 shadow-xs border border-gray-200">
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
          </div>
        </div>

        {/* Search & Annotation Filters */}
        <div className="flex items-center gap-3 mb-4">
          <SearchInput
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            wrapperClassName="w-[320px]"
            className="rounded-lg"
            style={{
              borderRadius: "8px",
              border: "1px solid #D8DCED",
            }}
          />

          <AnnotationFilterDropdown
            value={annotationFilter}
            onChange={onAnnotationFilterChange}
          />
        </div>

        {sortedProviders.length === 0 ? (
          <NoServersPlaceholder onAction={onAddServerClick} />
        ) : (
          <div className="space-y-3">
            {sortedProviders.map((provider) => (
              <ProviderCard
                key={provider.name}
                provider={provider}
                isDisabled={inactiveProviderNames?.has(provider.name) ?? false}
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
