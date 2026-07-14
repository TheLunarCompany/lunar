import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type {
  CapabilityItem,
  CapabilityProvider,
} from "@/components/capabilities/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { SearchInput } from "@/components/ui/search-input";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { cn } from "@/lib/utils";
import {
  buildSkillCapabilitySelectionKey,
  getCapabilityItemSelectionName,
  getCapabilityProviderSelectionId,
  type SkillCapabilityKind,
  type SkillCapabilitySelectionKey,
} from "@/mapping/skill-capabilities";

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

type VisibleProvider = {
  provider: CapabilityProvider;
  items: CapabilityItem[];
};

const sectionLabels: Record<SkillCapabilityKind, string> = {
  tool: "TOOLS",
  prompt: "PROMPTS",
};

const collapsedDescriptionLength = 250;

export function SkillCapabilityPicker({
  providers,
  selectedKeys,
  unavailableProviderNames = new Set(),
  unavailableProviderDescriptions = new Map(),
  providerFilters = [],
  onProviderFiltersChange,
  onSelectedKeysChange,
}: SkillCapabilityPickerProps) {
  const [query, setQuery] = React.useState("");
  const [expandedProviderNames, setExpandedProviderNames] = React.useState<
    Set<string>
  >(() => buildInitiallyExpandedProviderNames(providers, selectedKeys));
  const selectedProviderNamesRef = React.useRef(
    buildSelectedProviderNames(providers, selectedKeys),
  );

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const selectedProviderNames = React.useMemo(
    () => new Set(providerFilters),
    [providerFilters],
  );
  const providerFilteredProviders = React.useMemo(
    () =>
      providerFilters.length > 0
        ? providers.filter((provider) =>
            selectedProviderNames.has(provider.name),
          )
        : providers,
    [providerFilters.length, providers, selectedProviderNames],
  );
  const visibleProviders = React.useMemo(
    () => filterProviders(providerFilteredProviders, normalizedQuery),
    [providerFilteredProviders, normalizedQuery],
  );
  const isFilteringProvider = providerFilters.length > 0;

  React.useEffect(() => {
    const nextSelectedProviderNames = buildSelectedProviderNames(
      providers,
      selectedKeys,
    );
    const newlySelectedProviderNames = [...nextSelectedProviderNames].filter(
      (providerName) => !selectedProviderNamesRef.current.has(providerName),
    );

    selectedProviderNamesRef.current = nextSelectedProviderNames;

    if (newlySelectedProviderNames.length === 0) {
      return;
    }

    setExpandedProviderNames((current) => {
      const next = new Set(current);
      for (const providerName of newlySelectedProviderNames) {
        next.add(providerName);
      }
      return next;
    });
  }, [providers, selectedKeys]);

  function toggleProvider(providerName: string) {
    setExpandedProviderNames((current) => {
      const next = new Set(current);
      if (next.has(providerName)) {
        next.delete(providerName);
      } else {
        next.add(providerName);
      }
      return next;
    });
  }

  function toggleSelection(
    provider: CapabilityProvider,
    kind: SkillCapabilityKind,
    item: CapabilityItem,
    isUnavailable: boolean,
  ) {
    if (isUnavailable) {
      return;
    }

    const changedKey = buildSkillCapabilitySelectionKey(
      getCapabilityProviderSelectionId(provider),
      kind,
      getCapabilityItemSelectionName(item),
    );
    const nextSelectedKeys = new Set(selectedKeys);

    if (nextSelectedKeys.has(changedKey)) {
      nextSelectedKeys.delete(changedKey);
    } else {
      nextSelectedKeys.add(changedKey);
    }

    onSelectedKeysChange(nextSelectedKeys, changedKey);
  }

  function toggleProviderSelection(
    provider: CapabilityProvider,
    isUnavailable: boolean,
  ) {
    const providerSelectionKeys = getSelectableProviderSelectionKeys(
      provider,
      isUnavailable,
    );
    const changedKey = providerSelectionKeys[0];

    if (!changedKey) {
      return;
    }

    const providerSelectionState = getProviderSelectionState(
      providerSelectionKeys,
      selectedKeys,
    );
    const nextSelectedKeys = new Set(selectedKeys);

    for (const selectionKey of providerSelectionKeys) {
      if (providerSelectionState === true) {
        nextSelectedKeys.delete(selectionKey);
      } else {
        nextSelectedKeys.add(selectionKey);
      }
    }

    onSelectedKeysChange(nextSelectedKeys, changedKey);
  }

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
          selectedProviderNames={providerFilters}
          onSelectedProviderNamesChange={onProviderFiltersChange}
        />
      </div>

      {providers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No MCP tools or prompts available.
        </p>
      ) : visibleProviders.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No tools or prompts match your search.
        </p>
      ) : (
        <div
          data-testid="skill-capability-provider-list"
          className="divide-y divide-border rounded-md border border-border bg-[var(--colors-white)]"
        >
          {visibleProviders.map(({ provider, items }) => {
            const isExpanded =
              isSearching ||
              isFilteringProvider ||
              expandedProviderNames.has(provider.name);
            const isUnavailable = unavailableProviderNames.has(provider.name);
            const unavailableDescription =
              unavailableProviderDescriptions.get(provider.name) ??
              "This server is unavailable for this skill.";
            const selectedCount = countSelectedProviderItems(
              provider,
              selectedKeys,
            );
            const providerSelectionKeys = getSelectableProviderSelectionKeys(
              provider,
              isUnavailable,
            );
            const providerSelectionState = getProviderSelectionState(
              providerSelectionKeys,
              selectedKeys,
            );

            return (
              <section
                key={provider.name}
                data-testid={`skill-capability-provider-${provider.name}`}
              >
                {isSearching || isFilteringProvider ? (
                  <ProviderHeader
                    providerName={provider.name}
                    selectedCount={selectedCount}
                    itemCount={provider.items.length}
                    isExpanded
                    selectionState={providerSelectionState}
                    isSelectionDisabled={providerSelectionKeys.length === 0}
                    onToggleSelection={() =>
                      toggleProviderSelection(provider, isUnavailable)
                    }
                  />
                ) : (
                  <div className="flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50">
                    <ProviderSelectionCheckbox
                      providerName={provider.name}
                      checked={providerSelectionState}
                      disabled={providerSelectionKeys.length === 0}
                      onCheckedChange={() =>
                        toggleProviderSelection(provider, isUnavailable)
                      }
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-expanded={isExpanded}
                      onClick={() => toggleProvider(provider.name)}
                    >
                      <ProviderHeaderContent
                        providerName={provider.name}
                        selectedCount={selectedCount}
                        itemCount={provider.items.length}
                        isExpanded={isExpanded}
                      />
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div className="space-y-4 px-3 pb-3">
                    {isUnavailable && (
                      <p className="rounded-md border border-badge-warning-border bg-badge-warning-bg px-3 py-2 text-sm text-badge-warning-fg">
                        {unavailableDescription}
                      </p>
                    )}
                    <CapabilityKindSection
                      kind="tool"
                      provider={provider}
                      items={items.filter((item) => item.kind === "tool")}
                      selectedKeys={selectedKeys}
                      isUnavailable={isUnavailable}
                      onToggleSelection={toggleSelection}
                    />
                    <CapabilityKindSection
                      kind="prompt"
                      provider={provider}
                      items={items.filter((item) => item.kind === "prompt")}
                      selectedKeys={selectedKeys}
                      isUnavailable={isUnavailable}
                      onToggleSelection={toggleSelection}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
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
  const anchorRef = useComboboxAnchor();
  const providerNames = React.useMemo(
    () => providers.map((provider) => provider.name),
    [providers],
  );
  const selectedProviderNameSet = React.useMemo(
    () => new Set(selectedProviderNames),
    [selectedProviderNames],
  );
  const disabled = !onSelectedProviderNamesChange || providers.length === 0;

  function handleSelectedProviderNamesChange(nextValue: unknown) {
    if (!Array.isArray(nextValue)) {
      return;
    }

    onSelectedProviderNamesChange?.(
      providerNames.filter((providerName) => nextValue.includes(providerName)),
    );
  }

  return (
    <Combobox
      items={providerNames}
      multiple
      value={selectedProviderNames}
      onValueChange={handleSelectedProviderNamesChange}
      openOnInputClick
      disabled={disabled}
    >
      <div ref={anchorRef} className="w-full sm:w-64">
        <ComboboxChips className="min-h-9 w-full flex-nowrap overflow-hidden bg-white ">
          {selectedProviderNames.length > 0 && (
            <ComboboxValue>
              {selectedProviderNames.map((providerName) => (
                <ComboboxChip key={providerName} className={"bg-white border"}>
                  {providerName}
                </ComboboxChip>
              ))}
            </ComboboxValue>
          )}
          <ComboboxChipsInput
            aria-label="Filter MCP servers"
            className={cn(
              "min-w-0",
              selectedProviderNames.length === 0 ? "w-full" : "w-16",
            )}
            disabled={disabled}
            placeholder={
              selectedProviderNames.length === 0
                ? "All MCP servers"
                : "Search MCP servers"
            }
          />
        </ComboboxChips>
      </div>
      <ComboboxContent anchor={anchorRef} initialFocus={false}>
        <ComboboxEmpty>No MCP servers found.</ComboboxEmpty>
        <ComboboxList>
          {(providerName) => (
            <ComboboxItem
              key={providerName}
              value={providerName}
              data-checked={selectedProviderNameSet.has(providerName)}
            >
              <ProviderFilterOptionContent providerName={providerName} />
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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

function ProviderHeader({
  providerName,
  selectedCount,
  itemCount,
  isExpanded,
  selectionState,
  isSelectionDisabled,
  onToggleSelection,
}: {
  providerName: string;
  selectedCount: number;
  itemCount: number;
  isExpanded: boolean;
  selectionState: boolean | "indeterminate";
  isSelectionDisabled: boolean;
  onToggleSelection: () => void;
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left">
      <ProviderSelectionCheckbox
        providerName={providerName}
        checked={selectionState}
        disabled={isSelectionDisabled}
        onCheckedChange={onToggleSelection}
      />
      <ProviderHeaderContent
        providerName={providerName}
        selectedCount={selectedCount}
        itemCount={itemCount}
        isExpanded={isExpanded}
      />
    </div>
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
  provider,
  items,
  selectedKeys,
  isUnavailable,
  onToggleSelection,
}: {
  kind: SkillCapabilityKind;
  provider: CapabilityProvider;
  items: CapabilityItem[];
  selectedKeys: Set<SkillCapabilitySelectionKey>;
  isUnavailable: boolean;
  onToggleSelection: (
    provider: CapabilityProvider,
    kind: SkillCapabilityKind,
    item: CapabilityItem,
    isUnavailable: boolean,
  ) => void;
}) {
  const idPrefix = React.useId();
  const [expandedDescriptionKeys, setExpandedDescriptionKeys] = React.useState<
    Set<SkillCapabilitySelectionKey>
  >(new Set());

  if (items.length === 0) {
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
        {items.map((item) => {
          const selectionKey = buildSkillCapabilitySelectionKey(
            getCapabilityProviderSelectionId(provider),
            kind,
            getCapabilityItemSelectionName(item),
          );
          const isSelected = selectedKeys.has(selectionKey);
          const isDescriptionExpanded =
            expandedDescriptionKeys.has(selectionKey);
          const shouldClampDescription =
            Boolean(item.description) &&
            item.description.length > collapsedDescriptionLength;
          const hasWarning = isUnavailable || Boolean(item.unavailableReason);
          const checkboxId = `${idPrefix}-${selectionKey}`;
          const descriptionId = `${checkboxId}-description`;

          return (
            <div
              key={`${kind}:${item.id}`}
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
                disabled={isUnavailable}
                aria-label={`Select ${kind} ${item.name}`}
                aria-describedby={item.description ? descriptionId : undefined}
                onCheckedChange={() =>
                  onToggleSelection(provider, kind, item, isUnavailable)
                }
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1 space-y-1">
                <label
                  htmlFor={checkboxId}
                  className={cn(
                    "flex flex-wrap items-center gap-2",
                    isUnavailable ? "cursor-default" : "cursor-pointer",
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
                        shouldClampDescription &&
                          !isDescriptionExpanded &&
                          "line-clamp-3",
                      )}
                    >
                      {item.description}
                    </span>
                    {shouldClampDescription && (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        className="h-auto p-0 text-xs"
                        aria-expanded={isDescriptionExpanded}
                        aria-controls={descriptionId}
                        onClick={() => toggleDescription(selectionKey)}
                      >
                        {isDescriptionExpanded ? "Show less" : "Show more"}
                        <span className="sr-only">
                          {" "}
                          description for {item.name}
                        </span>
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
        })}
      </div>
    </div>
  );
}

function buildInitiallyExpandedProviderNames(
  providers: CapabilityProvider[],
  selectedKeys: Set<SkillCapabilitySelectionKey>,
): Set<string> {
  return buildSelectedProviderNames(providers, selectedKeys);
}

function buildSelectedProviderNames(
  providers: CapabilityProvider[],
  selectedKeys: Set<SkillCapabilitySelectionKey>,
): Set<string> {
  return new Set(
    providers
      .filter((provider) => providerHasSelectedItems(provider, selectedKeys))
      .map((provider) => provider.name),
  );
}

function providerHasSelectedItems(
  provider: CapabilityProvider,
  selectedKeys: Set<SkillCapabilitySelectionKey>,
) {
  const providerSelectionId = getCapabilityProviderSelectionId(provider);

  return provider.items.some((item) =>
    selectedKeys.has(
      buildSkillCapabilitySelectionKey(
        providerSelectionId,
        item.kind,
        getCapabilityItemSelectionName(item),
      ),
    ),
  );
}

function filterProviders(
  providers: CapabilityProvider[],
  normalizedQuery: string,
): VisibleProvider[] {
  if (!normalizedQuery) {
    return providers.map((provider) => ({
      provider,
      items: provider.items,
    }));
  }

  return providers.flatMap((provider) => {
    if (matchesText(provider.name, normalizedQuery)) {
      return [{ provider, items: provider.items }];
    }

    const matchingItems = provider.items.filter(
      (item) =>
        matchesText(item.name, normalizedQuery) ||
        matchesText(item.description, normalizedQuery),
    );

    return matchingItems.length > 0 ? [{ provider, items: matchingItems }] : [];
  });
}

function countSelectedProviderItems(
  provider: CapabilityProvider,
  selectedKeys: Set<SkillCapabilitySelectionKey>,
): number {
  const providerSelectionId = getCapabilityProviderSelectionId(provider);

  return provider.items.filter((item) =>
    selectedKeys.has(
      buildSkillCapabilitySelectionKey(
        providerSelectionId,
        item.kind,
        getCapabilityItemSelectionName(item),
      ),
    ),
  ).length;
}

function getSelectableProviderSelectionKeys(
  provider: CapabilityProvider,
  isUnavailable: boolean,
): SkillCapabilitySelectionKey[] {
  if (isUnavailable) {
    return [];
  }

  const providerSelectionId = getCapabilityProviderSelectionId(provider);

  return provider.items.map((item) =>
    buildSkillCapabilitySelectionKey(
      providerSelectionId,
      item.kind,
      getCapabilityItemSelectionName(item),
    ),
  );
}

function getProviderSelectionState(
  providerSelectionKeys: SkillCapabilitySelectionKey[],
  selectedKeys: Set<SkillCapabilitySelectionKey>,
): boolean | "indeterminate" {
  const selectedCount = providerSelectionKeys.filter((selectionKey) =>
    selectedKeys.has(selectionKey),
  ).length;

  if (selectedCount === 0) {
    return false;
  }

  if (selectedCount === providerSelectionKeys.length) {
    return true;
  }

  return "indeterminate";
}

function matchesText(value: string | undefined, normalizedQuery: string) {
  return value?.toLowerCase().includes(normalizedQuery) ?? false;
}
