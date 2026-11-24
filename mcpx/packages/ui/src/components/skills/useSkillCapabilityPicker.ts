import * as React from "react";

import type { CapabilityProvider } from "@/components/capabilities/types";
import type { SkillCapabilitySelectionKey } from "@/mapping/skill-capabilities";

import {
  buildSelectedProviderNames,
  buildSkillCapabilityPickerViewModel,
  getProviderSelectionState,
  getSelectableProviderSelectionKeys,
  type SkillCapabilityPickerViewModel,
} from "./skill-capability-picker-view-model";

const EMPTY_PROVIDER_FILTERS: string[] = [];
const EMPTY_COLLAPSED_PROVIDER_NAMES = new Set<string>();
const EMPTY_UNAVAILABLE_PROVIDER_NAMES = new Set<string>();
const EMPTY_UNAVAILABLE_PROVIDER_DESCRIPTIONS = new Map<string, string>();

export type UseSkillCapabilityPickerInput = {
  providers: CapabilityProvider[];
  selectedKeys: Set<SkillCapabilitySelectionKey>;
  providerFilters?: string[];
  unavailableProviderNames?: Set<string>;
  unavailableProviderDescriptions?: Map<string, string>;
  onSelectedKeysChange: (
    keys: Set<SkillCapabilitySelectionKey>,
    changedKey: SkillCapabilitySelectionKey,
  ) => void;
};

export type UseSkillCapabilityPickerResult = {
  query: string;
  setQuery: (query: string) => void;
  viewModel: SkillCapabilityPickerViewModel;
  toggleProviderExpanded: (providerName: string) => void;
  toggleItem: (
    selectionKey: SkillCapabilitySelectionKey,
    isDisabled: boolean,
  ) => void;
  toggleProviderSelection: (
    provider: CapabilityProvider,
    isUnavailable: boolean,
  ) => void;
};

/**
 * Headless core for {@link SkillCapabilityPicker}: owns the local UI state
 * (search query + provider expansion) and the selection handlers, and derives
 * the render-ready view model. Rendering is left to the component.
 */
export function useSkillCapabilityPicker({
  providers,
  selectedKeys,
  providerFilters = EMPTY_PROVIDER_FILTERS,
  unavailableProviderNames = EMPTY_UNAVAILABLE_PROVIDER_NAMES,
  unavailableProviderDescriptions = EMPTY_UNAVAILABLE_PROVIDER_DESCRIPTIONS,
  onSelectedKeysChange,
}: UseSkillCapabilityPickerInput): UseSkillCapabilityPickerResult {
  const [query, setQuery] = React.useState("");
  const [expandedProviderNames, setExpandedProviderNames] = React.useState(() =>
    buildSelectedProviderNames(providers, selectedKeys),
  );
  const [activeCollapseState, setActiveCollapseState] = React.useState({
    criteriaKey: "",
    providerNames: new Set<string>(),
  });
  const selectedProviderNamesRef = React.useRef(
    buildSelectedProviderNames(providers, selectedKeys),
  );
  const hasActiveCriteria =
    query.trim().length > 0 || providerFilters.length > 0;
  const activeCriteriaKey = JSON.stringify([
    query.trim().toLowerCase(),
    [...providerFilters].sort(),
  ]);
  const collapsedProviderNames =
    hasActiveCriteria && activeCollapseState.criteriaKey === activeCriteriaKey
      ? activeCollapseState.providerNames
      : EMPTY_COLLAPSED_PROVIDER_NAMES;

  // Auto-expand a provider the moment it *gains* a selection (e.g. loaded from
  // saved state), but never re-expand one the user has since collapsed.
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

  const viewModel = React.useMemo(
    () =>
      buildSkillCapabilityPickerViewModel({
        providers,
        providerFilters,
        query,
        selectedKeys,
        expandedProviderNames,
        collapsedProviderNames,
        unavailableProviderNames,
        unavailableProviderDescriptions,
      }),
    [
      providers,
      providerFilters,
      query,
      selectedKeys,
      expandedProviderNames,
      collapsedProviderNames,
      unavailableProviderNames,
      unavailableProviderDescriptions,
    ],
  );

  const toggleProviderExpanded = React.useCallback(
    (providerName: string) => {
      if (hasActiveCriteria) {
        setActiveCollapseState((current) => {
          const providerNames =
            current.criteriaKey === activeCriteriaKey
              ? new Set(current.providerNames)
              : new Set<string>();

          if (providerNames.has(providerName)) {
            providerNames.delete(providerName);
          } else {
            providerNames.add(providerName);
          }

          return { criteriaKey: activeCriteriaKey, providerNames };
        });
        return;
      }

      setExpandedProviderNames((current) => {
        const next = new Set(current);
        if (next.has(providerName)) {
          next.delete(providerName);
        } else {
          next.add(providerName);
        }
        return next;
      });
    },
    [activeCriteriaKey, hasActiveCriteria],
  );

  const toggleItem = React.useCallback(
    (selectionKey: SkillCapabilitySelectionKey, isDisabled: boolean) => {
      if (isDisabled) {
        return;
      }

      const nextSelectedKeys = new Set(selectedKeys);
      if (nextSelectedKeys.has(selectionKey)) {
        nextSelectedKeys.delete(selectionKey);
      } else {
        nextSelectedKeys.add(selectionKey);
      }

      onSelectedKeysChange(nextSelectedKeys, selectionKey);
    },
    [selectedKeys, onSelectedKeysChange],
  );

  const toggleProviderSelection = React.useCallback(
    (provider: CapabilityProvider, isUnavailable: boolean) => {
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
    },
    [selectedKeys, onSelectedKeysChange],
  );

  return {
    query,
    setQuery,
    viewModel,
    toggleProviderExpanded,
    toggleItem,
    toggleProviderSelection,
  };
}
