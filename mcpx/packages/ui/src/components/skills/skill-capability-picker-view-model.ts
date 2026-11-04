import type {
  CapabilityItem,
  CapabilityProvider,
} from "@/components/capabilities/types";
import {
  buildSkillCapabilitySelectionKey,
  getCapabilityItemSelectionName,
  getCapabilityProviderSelectionId,
  type SkillCapabilityKind,
  type SkillCapabilitySelectionKey,
} from "@/mapping/skill-capabilities";

export const collapsedDescriptionLength = 250;

const defaultUnavailableDescription =
  "This server is unavailable for this skill.";

export type CapabilityItemRow = {
  item: CapabilityItem;
  kind: SkillCapabilityKind;
  selectionKey: SkillCapabilitySelectionKey;
  isSelected: boolean;
  /** Provider-level unavailability — disables the item control. */
  isDisabled: boolean;
  /** Provider- or item-level unavailability — drives the warning styling. */
  hasWarning: boolean;
  shouldClampDescription: boolean;
};

export type CapabilityProviderRow = {
  provider: CapabilityProvider;
  name: string;
  /** Total items in the provider (independent of the active search filter). */
  itemCount: number;
  selectedCount: number;
  selectionState: boolean | "indeterminate";
  isSelectionDisabled: boolean;
  isExpanded: boolean;
  isUnavailable: boolean;
  unavailableDescription: string;
  toolRows: CapabilityItemRow[];
  promptRows: CapabilityItemRow[];
};

export type SkillCapabilityPickerEmptyReason = "no-providers" | "no-matches";

export type SkillCapabilityPickerViewModel = {
  providerRows: CapabilityProviderRow[];
  emptyReason: SkillCapabilityPickerEmptyReason | null;
  isSearching: boolean;
  isFilteringProvider: boolean;
};

export type BuildSkillCapabilityPickerViewModelInput = {
  providers: CapabilityProvider[];
  providerFilters: string[];
  query: string;
  selectedKeys: Set<SkillCapabilitySelectionKey>;
  expandedProviderNames: Set<string>;
  collapsedProviderNames: Set<string>;
  unavailableProviderNames: Set<string>;
  unavailableProviderDescriptions: Map<string, string>;
};

type VisibleProvider = {
  provider: CapabilityProvider;
  items: CapabilityItem[];
};

/**
 * Derives everything the picker UI renders from its inputs. Pure: no React, no
 * side effects — the component maps over the result rather than computing it.
 */
export function buildSkillCapabilityPickerViewModel({
  providers,
  providerFilters,
  query,
  selectedKeys,
  expandedProviderNames,
  collapsedProviderNames,
  unavailableProviderNames,
  unavailableProviderDescriptions,
}: BuildSkillCapabilityPickerViewModelInput): SkillCapabilityPickerViewModel {
  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const isFilteringProvider = providerFilters.length > 0;

  const providerFilterSet = new Set(providerFilters);
  const providerFilteredProviders = isFilteringProvider
    ? providers.filter((provider) => providerFilterSet.has(provider.name))
    : providers;
  const visibleProviders = filterProviders(
    providerFilteredProviders,
    normalizedQuery,
  );

  const providerRows = visibleProviders.map(({ provider, items }) => {
    const isUnavailable = unavailableProviderNames.has(provider.name);
    const selectionKeys = getSelectableProviderSelectionKeys(
      provider,
      isUnavailable,
    );

    return {
      provider,
      name: provider.name,
      itemCount: provider.items.length,
      selectedCount: countSelectedProviderItems(provider, selectedKeys),
      selectionState: getProviderSelectionState(selectionKeys, selectedKeys),
      isSelectionDisabled: selectionKeys.length === 0,
      isExpanded:
        isSearching || isFilteringProvider
          ? !collapsedProviderNames.has(provider.name)
          : expandedProviderNames.has(provider.name),
      isUnavailable,
      unavailableDescription:
        unavailableProviderDescriptions.get(provider.name) ??
        defaultUnavailableDescription,
      toolRows: buildItemRows(
        provider,
        items,
        "tool",
        selectedKeys,
        isUnavailable,
      ),
      promptRows: buildItemRows(
        provider,
        items,
        "prompt",
        selectedKeys,
        isUnavailable,
      ),
    } satisfies CapabilityProviderRow;
  });

  const emptyReason: SkillCapabilityPickerEmptyReason | null =
    providers.length === 0
      ? "no-providers"
      : visibleProviders.length === 0
        ? "no-matches"
        : null;

  return { providerRows, emptyReason, isSearching, isFilteringProvider };
}

function buildItemRows(
  provider: CapabilityProvider,
  items: CapabilityItem[],
  kind: SkillCapabilityKind,
  selectedKeys: Set<SkillCapabilitySelectionKey>,
  isProviderUnavailable: boolean,
): CapabilityItemRow[] {
  const providerSelectionId = getCapabilityProviderSelectionId(provider);

  return items
    .filter((item) => item.kind === kind)
    .map((item) => {
      const selectionKey = buildSkillCapabilitySelectionKey(
        providerSelectionId,
        kind,
        getCapabilityItemSelectionName(item),
      );

      return {
        item,
        kind,
        selectionKey,
        isSelected: selectedKeys.has(selectionKey),
        isDisabled: isProviderUnavailable,
        hasWarning: isProviderUnavailable || Boolean(item.unavailableReason),
        shouldClampDescription:
          Boolean(item.description) &&
          item.description.length > collapsedDescriptionLength,
      } satisfies CapabilityItemRow;
    });
}

export function buildSelectedProviderNames(
  providers: CapabilityProvider[],
  selectedKeys: Set<SkillCapabilitySelectionKey>,
): Set<string> {
  return new Set(
    providers
      .filter((provider) => providerHasSelectedItems(provider, selectedKeys))
      .map((provider) => provider.name),
  );
}

export function getSelectableProviderSelectionKeys(
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

export function getProviderSelectionState(
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

function providerHasSelectedItems(
  provider: CapabilityProvider,
  selectedKeys: Set<SkillCapabilitySelectionKey>,
): boolean {
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

function matchesText(value: string | undefined, normalizedQuery: string) {
  return value?.toLowerCase().includes(normalizedQuery) ?? false;
}
