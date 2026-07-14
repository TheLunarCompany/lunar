import * as React from "react";
import { ChevronDown, ChevronRight, ListFilter } from "lucide-react";

import type { CapabilityProvider } from "@/components/capabilities/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectFilterDropdown } from "@/components/ui/multi-select-filter-dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { cn } from "@/lib/utils";
import type {
  SkillCapabilityKind,
  SkillCapabilitySelectionKey,
} from "@/mapping/skill-capabilities";

import type {
  CapabilityItemRow,
  CapabilityProviderRow,
} from "./skill-capability-picker-view-model";
import { useSkillCapabilityPicker } from "./useSkillCapabilityPicker";

export type SkillCapabilityPickerProps = {
  providers: CapabilityProvider[];
  selectedKeys: Set<SkillCapabilitySelectionKey>;
  unavailableProviderNames?: Set<string>;
  unavailableProviderDescriptions?: Map<string, string>;
  providerFilters?: string[];
  onProviderFiltersChange?: (providerNames: string[]) => void;
  onSelectedKeysChange: (
    keys: Set<SkillCapabilitySelectionKey>,
    changedKey: SkillCapabilitySelectionKey,
  ) => void;
};

type ToggleItem = (
  selectionKey: SkillCapabilitySelectionKey,
  isDisabled: boolean,
) => void;

const sectionLabels: Record<SkillCapabilityKind, string> = {
  tool: "TOOLS",
  prompt: "PROMPTS",
};

export function SkillCapabilityPicker({
  providers,
  selectedKeys,
  unavailableProviderNames,
  unavailableProviderDescriptions,
  providerFilters,
  onProviderFiltersChange,
  onSelectedKeysChange,
}: SkillCapabilityPickerProps) {
  const {
    query,
    setQuery,
    viewModel,
    toggleProviderExpanded,
    toggleItem,
    toggleProviderSelection,
  } = useSkillCapabilityPicker({
    providers,
    selectedKeys,
    providerFilters,
    unavailableProviderNames,
    unavailableProviderDescriptions,
    onSelectedKeysChange,
  });

  return (
    <div className="min-w-0 space-y-3 py-1">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput
          role="searchbox"
          aria-label="Search MCP tools and prompts"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search MCP tools and prompts"
          wrapperClassName="min-w-0 flex-1"
        />
        <ProviderFilterMultiSelect
          providers={providers}
          selectedProviderNames={providerFilters ?? []}
          onSelectedProviderNamesChange={onProviderFiltersChange}
        />
      </div>

      {viewModel.emptyReason === "no-providers" ? (
        <PickerEmptyState>No MCP tools or prompts available.</PickerEmptyState>
      ) : viewModel.emptyReason === "no-matches" ? (
        <PickerEmptyState>
          No tools or prompts match your search.
        </PickerEmptyState>
      ) : (
        <div
          data-testid="skill-capability-provider-list"
          className="divide-y divide-border rounded-md border border-border bg-[var(--colors-white)]"
        >
          {viewModel.providerRows.map((row) => (
            <ProviderRow
              key={row.name}
              row={row}
              onToggleExpanded={() => toggleProviderExpanded(row.name)}
              onToggleProviderSelection={() =>
                toggleProviderSelection(row.provider, row.isUnavailable)
              }
              onToggleItem={toggleItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PickerEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function ProviderRow({
  row,
  onToggleExpanded,
  onToggleProviderSelection,
  onToggleItem,
}: {
  row: CapabilityProviderRow;
  onToggleExpanded: () => void;
  onToggleProviderSelection: () => void;
  onToggleItem: ToggleItem;
}) {
  return (
    <section data-testid={`skill-capability-provider-${row.name}`}>
      <div className="flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50">
        <ProviderSelectionCheckbox
          providerName={row.name}
          checked={row.selectionState}
          disabled={row.isSelectionDisabled}
          onCheckedChange={onToggleProviderSelection}
        />
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={row.isExpanded}
          onClick={onToggleExpanded}
        >
          <ProviderHeaderContent
            providerName={row.name}
            selectedCount={row.selectedCount}
            itemCount={row.itemCount}
            isExpanded={row.isExpanded}
          />
        </button>
      </div>

      {row.isExpanded && (
        <div className="space-y-4 px-3 pb-3">
          {row.isUnavailable && (
            <p className="rounded-md border border-badge-warning-border bg-badge-warning-bg px-3 py-2 text-sm text-badge-warning-fg">
              {row.unavailableDescription}
            </p>
          )}
          <CapabilityKindSection
            kind="tool"
            rows={row.toolRows}
            onToggleItem={onToggleItem}
          />
          <CapabilityKindSection
            kind="prompt"
            rows={row.promptRows}
            onToggleItem={onToggleItem}
          />
        </div>
      )}
    </section>
  );
}

function ProviderFilterMultiSelect({
  providers,
  selectedProviderNames,
  onSelectedProviderNamesChange,
}: {
  providers: CapabilityProvider[];
  selectedProviderNames: string[];
  onSelectedProviderNamesChange?: (providerNames: string[]) => void;
}) {
  const disabled = !onSelectedProviderNamesChange || providers.length === 0;
  const selectedCount = selectedProviderNames.length;
  const isAll = selectedCount === 0;

  return (
    <MultiSelectFilterDropdown
      options={providers}
      getOptionValue={(provider) => provider.name}
      renderOption={(provider) => (
        <ProviderFilterOptionContent providerName={provider.name} />
      )}
      selectedValues={selectedProviderNames}
      onSelectedValuesChange={(names) => onSelectedProviderNamesChange?.(names)}
      allLabel="All MCP servers"
      disabled={disabled}
      triggerClassName={buttonVariants({
        variant: "ghost",
        size: "sm",
        className: "cursor-pointer",
      })}
      triggerContent={
        <>
          <ListFilter className="mr-2 size-4" />
          <span>
            Filter MCP servers
            {!isAll && (
              <span className="ml-1.5 text-xs text-[var(--colors-gray-500)]">
                ({selectedCount})
              </span>
            )}
          </span>
        </>
      }
    />
  );
}

function ProviderFilterOptionContent({
  providerName,
}: {
  providerName: string;
}) {
  return (
    <>
      <ProviderFilterOptionIcon name={providerName} />
      <span className="truncate">{providerName}</span>
    </>
  );
}

function ProviderFilterOptionIcon({ name }: { name: string }) {
  const iconUrl = useDomainIcon(name);

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        aria-hidden="true"
        className="size-5 shrink-0 object-contain"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid size-5 shrink-0 place-items-center rounded bg-[var(--colors-gray-900)] text-[10px] font-semibold text-[var(--colors-white)]"
    >
      {getProviderInitial(name)}
    </span>
  );
}

function ProviderSelectionCheckbox({
  providerName,
  checked,
  disabled,
  onCheckedChange,
}: {
  providerName: string;
  checked: boolean | "indeterminate";
  disabled: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label={`Select all tools and prompts from ${providerName}`}
      onCheckedChange={onCheckedChange}
      className="shrink-0"
    />
  );
}

function ProviderHeaderContent({
  providerName,
  selectedCount,
  itemCount,
  isExpanded,
}: {
  providerName: string;
  selectedCount: number;
  itemCount: number;
  isExpanded: boolean;
}) {
  return (
    <>
      {isExpanded ? (
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      ) : (
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      )}
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <ProviderIcon name={providerName} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {providerName}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {selectedCount} of {itemCount} selected
      </span>
    </>
  );
}

function ProviderIcon({ name }: { name: string }) {
  const iconUrl = useDomainIcon(name);

  if (iconUrl) {
    return (
      <span
        aria-hidden="true"
        data-testid={`skill-capability-provider-icon-${name}`}
        className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--colors-white)]"
      >
        <img src={iconUrl} alt="" className="size-6 rounded object-contain" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      data-testid={`skill-capability-provider-icon-${name}`}
      className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--colors-gray-900)] text-xs font-semibold text-[var(--colors-white)]"
    >
      {getProviderInitial(name)}
    </span>
  );
}

function getProviderInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function CapabilityKindSection({
  kind,
  rows,
  onToggleItem,
}: {
  kind: SkillCapabilityKind;
  rows: CapabilityItemRow[];
  onToggleItem: ToggleItem;
}) {
  const idPrefix = React.useId();
  const [expandedDescriptionKeys, setExpandedDescriptionKeys] = React.useState<
    Set<SkillCapabilitySelectionKey>
  >(new Set());

  if (rows.length === 0) {
    return null;
  }

  function toggleDescription(selectionKey: SkillCapabilitySelectionKey) {
    setExpandedDescriptionKeys((current) => {
      const next = new Set(current);
      if (next.has(selectionKey)) {
        next.delete(selectionKey);
      } else {
        next.add(selectionKey);
      }
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {sectionLabels[kind]}
      </h3>
      <div className="space-y-1">
        {rows.map((row) => (
          <CapabilityItemRowView
            key={`${kind}:${row.item.id}`}
            row={row}
            idPrefix={idPrefix}
            isDescriptionExpanded={expandedDescriptionKeys.has(
              row.selectionKey,
            )}
            onToggleDescription={() => toggleDescription(row.selectionKey)}
            onToggleItem={() => onToggleItem(row.selectionKey, row.isDisabled)}
          />
        ))}
      </div>
    </div>
  );
}

function CapabilityItemRowView({
  row,
  idPrefix,
  isDescriptionExpanded,
  onToggleDescription,
  onToggleItem,
}: {
  row: CapabilityItemRow;
  idPrefix: string;
  isDescriptionExpanded: boolean;
  onToggleDescription: () => void;
  onToggleItem: () => void;
}) {
  const { item, kind, selectionKey, isSelected, isDisabled, hasWarning } = row;
  const checkboxId = `${idPrefix}-${selectionKey}`;
  const descriptionId = `${checkboxId}-description`;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border border-transparent px-2 py-2 text-sm transition-colors",
        hasWarning
          ? "border-badge-warning-border bg-badge-warning-bg"
          : "hover:border-border hover:bg-muted/50",
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={isSelected}
        disabled={isDisabled}
        aria-label={`Select ${kind} ${item.name}`}
        aria-describedby={item.description ? descriptionId : undefined}
        onCheckedChange={onToggleItem}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1 space-y-1">
        <label
          htmlFor={checkboxId}
          className={cn(
            "flex flex-wrap items-center gap-2",
            isDisabled ? "cursor-default" : "cursor-pointer",
          )}
        >
          <span className="break-words font-medium text-foreground">
            {item.name}
          </span>
          {item.annotations?.readOnlyHint === true && (
            <Badge variant="success" size="sm">
              READ ONLY
            </Badge>
          )}
          {item.annotations?.destructiveHint === true && (
            <Badge variant="danger" size="sm">
              DESTRUCTIVE
            </Badge>
          )}
        </label>
        {item.description && (
          <span className="block space-y-1">
            <span
              id={descriptionId}
              className={cn(
                "block break-words text-xs text-muted-foreground",
                row.shouldClampDescription &&
                  !isDescriptionExpanded &&
                  "line-clamp-3",
              )}
            >
              {item.description}
            </span>
            {row.shouldClampDescription && (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto p-0 text-xs"
                aria-expanded={isDescriptionExpanded}
                aria-controls={descriptionId}
                onClick={onToggleDescription}
              >
                {isDescriptionExpanded ? "Show less" : "Show more"}
                <span className="sr-only"> description for {item.name}</span>
              </Button>
            )}
          </span>
        )}
        {item.unavailableReason ? (
          <span className="block break-words text-xs text-badge-warning-fg">
            {item.unavailableReason}
          </span>
        ) : null}
      </span>
    </div>
  );
}
