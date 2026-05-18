import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { ListFilter, Plus } from "lucide-react";
import { CapabilityProviderCard } from "./CapabilityProviderCard";
import type {
  CapabilityAnnotationFilterValue,
  CapabilityItem,
  CapabilityProvider,
  CapabilitySelectionKey,
} from "./types";

type CapabilityProvidersSectionProps = {
  providers: CapabilityProvider[];
  expandedProviders: Set<string>;
  isSelectionMode?: boolean;
  isAddCustomToolMode?: boolean;
  selectedCapabilityKeys?: Set<CapabilitySelectionKey>;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  annotationFilter: CapabilityAnnotationFilterValue[];
  onAnnotationFilterChange: (filter: CapabilityAnnotationFilterValue[]) => void;
  onProviderClick: (providerName: string) => void;
  onAddServerClick?: () => void;
  onCapabilitySelectionChange?: (
    item: CapabilityItem,
    providerName: string,
    isSelected: boolean,
  ) => void;
  onShowItemDetails?: (item: CapabilityItem) => void;
  onCustomizeItem?: (item: CapabilityItem) => void;
  onEditItem?: (item: CapabilityItem) => void;
  onDeleteItem?: (item: CapabilityItem) => void;
};

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
  const selectedValues = new Set(value);
  const selectedCount = value.length;
  const isAll = selectedCount === 0;

  function toggleValue(
    nextValue: CapabilityAnnotationFilterValue,
    checked: boolean,
  ) {
    const nextSelection = new Set(selectedValues);
    if (checked) {
      nextSelection.add(nextValue);
    } else {
      nextSelection.delete(nextValue);
    }
    onChange([...nextSelection]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "cursor-pointer",
        })}
      >
        <ListFilter className="mr-2 size-4" />
        Filter Tools
        {!isAll && (
          <span className="ml-1.5 text-xs text-[var(--colors-gray-500)]">
            ({selectedCount})
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48 p-2">
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={isAll}
            onCheckedChange={() => onChange([])}
          >
            All
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {annotationFilterOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedValues.has(option.value)}
              onCheckedChange={(checked) =>
                toggleValue(option.value, checked === true)
              }
            >
              <span className={cn("size-1.5 rounded-full", option.dot)} />
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CapabilityProvidersSection({
  providers,
  expandedProviders,
  isSelectionMode = false,
  isAddCustomToolMode = false,
  selectedCapabilityKeys = new Set(),
  searchQuery,
  onSearchQueryChange,
  annotationFilter,
  onAnnotationFilterChange,
  onProviderClick,
  onAddServerClick,
  onCapabilitySelectionChange,
  onShowItemDetails,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
}: CapabilityProvidersSectionProps) {
  return (
    <section className="rounded-lg border border-[var(--colors-gray-200)] bg-white p-6 shadow-xs">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-base font-semibold text-[var(--colors-gray-900)]">
          Capabilities Catalog
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Search tools, prompts and resources"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          wrapperClassName="w-[320px] max-w-full"
          className="rounded-lg"
        />
        <AnnotationFilterDropdown
          value={annotationFilter}
          onChange={onAnnotationFilterChange}
        />
      </div>

      {providers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--colors-gray-200)] bg-[var(--colors-gray-50)] p-8 text-center">
          <p className="font-medium text-[var(--colors-gray-900)]">
            No tools available
          </p>
          <p className="mt-1 text-sm text-[var(--colors-gray-600)]">
            Connect a server to see tools in the catalog.
          </p>
          {onAddServerClick && (
            <Button className="mt-4" size="sm" onClick={onAddServerClick}>
              <Plus className="size-4" />
              Add Server
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <CapabilityProviderCard
              key={provider.name}
              provider={provider}
              isExpanded={expandedProviders.has(provider.name)}
              isSelectionMode={isSelectionMode}
              isAddCustomToolMode={isAddCustomToolMode}
              selectedCapabilityKeys={selectedCapabilityKeys}
              onProviderClick={onProviderClick}
              onCapabilitySelectionChange={onCapabilitySelectionChange}
              onShowItemDetails={onShowItemDetails}
              onCustomizeItem={onCustomizeItem}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
            />
          ))}
        </div>
      )}
    </section>
  );
}
