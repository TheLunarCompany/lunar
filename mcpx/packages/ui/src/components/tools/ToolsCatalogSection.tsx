import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Check, ListFilter, Search } from "lucide-react";
import {
  ProviderCard,
  ToolSelectionItem,
} from "@/components/tools/ProviderCard";
import { NoServersPlaceholder } from "@/components/tools/EmptyStatePlaceholders";
import { ToolCardTool } from "@/components/tools/ToolCard";
import { TargetServer } from "@mcpx/shared-model";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

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

type AnnotationFilterValue = "all" | "read-only" | "write" | "destructive";

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
  onSearchQueryChange: (query: string) => void;
  annotationFilter: AnnotationFilterValue;
  onAnnotationFilterChange: (filter: AnnotationFilterValue) => void;
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
  value: AnnotationFilterValue;
  onChange: (v: AnnotationFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const isAll = value === "all";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <ListFilter className="h-4 w-4 mr-2" />
          Filter
          {!isAll && <span className="ml-1.5 text-xs text-[#7D7B98]">(1)</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          className={cn(
            "z-50 min-w-[12rem] overflow-hidden rounded-md border border-gray-200 bg-white p-2 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
          align="start"
          sideOffset={4}
        >
          <DropdownMenuItem
            className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-gray-50 focus:bg-gray-50"
            onSelect={(e) => {
              e.preventDefault();
              onChange("all");
            }}
          >
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border",
                isAll ? "bg-blue-600 border-blue-600" : "border-gray-300",
              )}
            >
              {isAll && (
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              )}
            </div>
            <span className="text-gray-700">All</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 h-px bg-gray-200" />

          {ANNOTATION_FILTER_OPTIONS.map(({ value: optValue, label, dot }) => {
            const checked = value === optValue;
            return (
              <DropdownMenuItem
                key={optValue}
                className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-gray-50 focus:bg-gray-50"
                onSelect={(e) => {
                  e.preventDefault();
                  onChange(checked ? "all" : optValue);
                }}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    checked ? "bg-blue-600 border-blue-600" : "border-gray-300",
                  )}
                >
                  {checked && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                <span className="text-gray-700">{label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
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
            {searchQuery && totalFilteredTools > 0 && (
              <div className={styles.filterInfo}>
                <span className={styles.filterBadge}>
                  {totalFilteredTools} tool{totalFilteredTools !== 1 ? "s" : ""}{" "}
                  found
                </span>
                <span className={styles.searchTerm}>
                  Search: &quot;{searchQuery}&quot;
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Search & Annotation Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-[320px]">
            <Input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pr-10 rounded-lg"
              style={{
                borderRadius: "8px",
                border: "1px solid #D8DCED",
              }}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

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
