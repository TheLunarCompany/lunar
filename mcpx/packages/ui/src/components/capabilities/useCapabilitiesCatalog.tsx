import { useMemo, useState } from "react";

import { useToast } from "@/components/ui/use-toast";
import { useSocketStore } from "@/store/socket";
import {
  createCapabilityGroup,
  deleteCapabilityGroup,
  updateCapabilityGroup,
} from "./capability-actions";
import {
  buildCapabilitySelectionKey,
  splitCapabilitySelectionKey,
} from "./capability-selection-key";
import {
  buildCapabilityGroupsFromCurrentToolGroups,
  buildCapabilityProvidersFromCurrentTools,
} from "./current-tool-capabilities";
import type {
  CapabilityAnnotationFilterValue,
  CapabilityGroup,
  CapabilityProvider,
  CapabilitySelectionKey,
} from "./types";

type GroupDraft = {
  name: string;
  description: string;
};

function normalizeGroupName(name: string): string {
  return name.trim().toLowerCase();
}

function matchesAnnotationFilter(
  provider: CapabilityProvider,
  filters: CapabilityAnnotationFilterValue[],
): CapabilityProvider {
  if (filters.length === 0) {
    return provider;
  }

  return {
    ...provider,
    items: provider.items.filter((item) => {
      const annotations = item.annotations;
      if (!annotations) {
        return false;
      }

      return filters.some((filter) => {
        switch (filter) {
          case "read-only":
            return annotations.readOnlyHint === true;
          case "destructive":
            return annotations.destructiveHint === true;
          case "write":
            return !annotations.readOnlyHint && !annotations.destructiveHint;
        }
      });
    }),
  };
}

function filterProvidersBySelectedGroup(
  providers: CapabilityProvider[],
  selectedGroup: CapabilityGroup | null,
): CapabilityProvider[] {
  if (!selectedGroup) {
    return providers;
  }

  return providers
    .map((provider) => {
      const configuredItems = selectedGroup.services[provider.name];

      if (!configuredItems) {
        return { ...provider, items: [] };
      }

      if (configuredItems === "*") {
        return provider;
      }

      const configuredItemNames = new Set(configuredItems);

      return {
        ...provider,
        items: provider.items.filter((item) =>
          configuredItemNames.has(item.name),
        ),
      };
    })
    .filter((provider) => provider.items.length > 0);
}

function buildVisibleSelectionKeys(
  providers: CapabilityProvider[],
): Set<CapabilitySelectionKey> {
  return new Set(
    providers.flatMap((provider) =>
      provider.items.map((item) =>
        buildCapabilitySelectionKey(provider.name, item.name),
      ),
    ),
  );
}

function selectionKeysFromServices(
  services: CapabilityGroup["services"],
  providers: CapabilityProvider[],
): Set<CapabilitySelectionKey> {
  const visibleItemsByProvider = new Map(
    providers.map((provider) => [
      provider.name,
      provider.items.map((item) => item.name),
    ]),
  );

  return new Set(
    Object.entries(services).flatMap(([providerName, itemNames]) => {
      const effectiveItemNames =
        itemNames === "*"
          ? (visibleItemsByProvider.get(providerName) ?? [])
          : itemNames;

      return effectiveItemNames.map((itemName) =>
        buildCapabilitySelectionKey(providerName, itemName),
      );
    }),
  );
}

function servicesFromSelectionKeys(
  selectedCapabilityKeys: Set<CapabilitySelectionKey>,
): CapabilityGroup["services"] {
  const services = new Map<string, string[]>();

  selectedCapabilityKeys.forEach((key) => {
    const { providerName, itemName } = splitCapabilitySelectionKey(key);
    if (!providerName || !itemName) {
      return;
    }

    const providerItems = services.get(providerName) ?? [];
    providerItems.push(itemName);
    services.set(providerName, providerItems);
  });

  return Object.fromEntries(services);
}

function servicesFromEditingSelection(args: {
  selectedCapabilityKeys: Set<CapabilitySelectionKey>;
  selectedGroup: CapabilityGroup;
  modifiedProviderNames: Set<string>;
}): CapabilityGroup["services"] {
  const services = servicesFromSelectionKeys(args.selectedCapabilityKeys);

  Object.entries(args.selectedGroup.services).forEach(
    ([providerName, savedItems]) => {
      if (savedItems === "*" && !args.modifiedProviderNames.has(providerName)) {
        services[providerName] = "*";
      }
    },
  );

  return services;
}

function mergeUnavailableSavedSelectionKeys(args: {
  selectedCapabilityKeys: Set<CapabilitySelectionKey>;
  selectedGroup: CapabilityGroup;
  providers: CapabilityProvider[];
}): Set<CapabilitySelectionKey> {
  const visibleSelectionKeys = buildVisibleSelectionKeys(args.providers);
  const savedSelectionKeys = selectionKeysFromServices(
    args.selectedGroup.services,
    args.providers,
  );
  const mergedSelectionKeys = new Set(args.selectedCapabilityKeys);

  savedSelectionKeys.forEach((key) => {
    if (!visibleSelectionKeys.has(key)) {
      mergedSelectionKeys.add(key);
    }
  });

  return mergedSelectionKeys;
}

function getErrorDescription(error: unknown): string {
  return error instanceof Error ? error.message : "Please try again.";
}

export function useCapabilitiesCatalog() {
  const { systemState, appConfig } = useSocketStore((state) => ({
    systemState: state.systemState,
    appConfig: state.appConfig,
  }));
  const { toast, dismiss } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [annotationFilter, setAnnotationFilter] = useState<
    CapabilityAnnotationFilterValue[]
  >([]);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(
    null,
  );
  const [selectedCapabilityKeys, setSelectedCapabilityKeys] = useState<
    Set<CapabilitySelectionKey>
  >(new Set());
  const [modifiedSelectionProviders, setModifiedSelectionProviders] = useState<
    Set<string>
  >(new Set());
  const [editingGroup, setEditingGroup] = useState<CapabilityGroup | null>(
    null,
  );
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [editGroupError, setEditGroupError] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const providers = useMemo(
    () =>
      buildCapabilityProvidersFromCurrentTools({
        targetServers: systemState?.targetServers,
        toolExtensionsServices: appConfig?.toolExtensions?.services,
      }),
    [appConfig?.toolExtensions?.services, systemState?.targetServers],
  );

  const groups = useMemo(
    () =>
      buildCapabilityGroupsFromCurrentToolGroups({
        toolGroups: appConfig?.toolGroups,
        providers,
      }),
    [appConfig?.toolGroups, providers],
  );

  const selectedGroup = useMemo(
    () =>
      selectedGroupName
        ? (groups.find((group) => group.name === selectedGroupName) ?? null)
        : null,
    [groups, selectedGroupName],
  );

  const visibleProviders = useMemo(() => {
    const searchQueryLower = searchQuery.trim().toLowerCase();

    return filterProvidersBySelectedGroup(providers, selectedGroup)
      .map((provider) => {
        if (!searchQueryLower) {
          return provider;
        }

        return {
          ...provider,
          items: provider.items.filter((item) =>
            item.name.toLowerCase().includes(searchQueryLower),
          ),
        };
      })
      .map((provider) => matchesAnnotationFilter(provider, annotationFilter))
      .filter((provider) => provider.items.length > 0);
  }, [annotationFilter, providers, searchQuery, selectedGroup]);

  function validateGroupName(
    name: string,
    originalName?: string,
  ): string | null {
    if (!name.trim()) {
      return "Group name cannot be empty";
    }

    const normalizedName = normalizeGroupName(name);
    const normalizedOriginalName = originalName
      ? normalizeGroupName(originalName)
      : null;
    const hasDuplicate = groups.some(
      (group) =>
        normalizeGroupName(group.name) === normalizedName &&
        normalizeGroupName(group.name) !== normalizedOriginalName,
    );

    if (hasDuplicate) {
      return `A capability group named "${name.trim()}" already exists.`;
    }

    return null;
  }

  function toggleProviderExpansion(providerName: string) {
    setExpandedProviders((currentProviders) => {
      const nextProviders = new Set(currentProviders);

      if (nextProviders.has(providerName)) {
        nextProviders.delete(providerName);
      } else {
        nextProviders.add(providerName);
      }

      return nextProviders;
    });
  }

  function clearProviderExpansion() {
    setExpandedProviders(new Set());
  }

  function expandProviderSections() {
    setExpandedProviders(
      new Set(
        providers
          .filter((provider) => provider.items.length > 0)
          .map((provider) => provider.name),
      ),
    );
  }

  function selectGroup(groupName: string | null) {
    setSelectedGroupName(groupName);
  }

  function toggleCapabilitySelection(
    key: CapabilitySelectionKey,
    selected?: boolean,
  ) {
    const { providerName } = splitCapabilitySelectionKey(key);

    setSelectedCapabilityKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);
      const shouldSelect = selected ?? !nextKeys.has(key);

      if (shouldSelect) {
        nextKeys.add(key);
      } else {
        nextKeys.delete(key);
      }

      return nextKeys;
    });
    setModifiedSelectionProviders((currentProviders) => {
      const nextProviders = new Set(currentProviders);
      nextProviders.add(providerName);
      return nextProviders;
    });
  }

  function startCreatingGroup() {
    setCreateGroupError(null);
    setEditGroupError(null);
    setEditingGroup(null);
    setSelectedCapabilityKeys(new Set());
    setModifiedSelectionProviders(new Set());
  }

  function startEditingGroup(groupName: string) {
    const group = groups.find((candidate) => candidate.name === groupName);

    setCreateGroupError(null);
    setEditGroupError(null);
    setEditingGroup(group ?? null);
    setSelectedCapabilityKeys(
      group ? selectionKeysFromServices(group.services, providers) : new Set(),
    );
    setModifiedSelectionProviders(new Set());
  }

  async function createGroup({ name, description }: GroupDraft) {
    const groupName = name.trim();
    const validationError = validateGroupName(groupName);

    if (validationError) {
      setCreateGroupError(validationError);
      return false;
    }

    if (selectedCapabilityKeys.size === 0) {
      setCreateGroupError("Please select at least one capability.");
      return false;
    }

    const trimmedDescription = description.trim();

    try {
      setIsCreatingGroup(true);
      setCreateGroupError(null);
      await createCapabilityGroup({
        name: groupName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        services: servicesFromSelectionKeys(selectedCapabilityKeys),
      });
      return true;
    } catch (error) {
      toast({
        title: "Failed to create capability group",
        description: getErrorDescription(error),
        variant: "destructive",
      });
      return false;
    } finally {
      setIsCreatingGroup(false);
    }
  }

  async function updateEditingGroup({ name, description }: GroupDraft) {
    if (!editingGroup) {
      setEditGroupError("No capability group selected.");
      return false;
    }

    const groupName = name.trim();
    const validationError = validateGroupName(groupName, editingGroup.name);

    if (validationError) {
      setEditGroupError(validationError);
      return false;
    }

    const preservedSelectionKeys = mergeUnavailableSavedSelectionKeys({
      selectedCapabilityKeys,
      selectedGroup: editingGroup,
      providers,
    });
    const trimmedDescription = description.trim();

    try {
      setIsUpdatingGroup(true);
      setEditGroupError(null);
      await updateCapabilityGroup(editingGroup.name, {
        ...(groupName !== editingGroup.name ? { name: groupName } : {}),
        description: trimmedDescription || undefined,
        services: servicesFromEditingSelection({
          selectedCapabilityKeys: preservedSelectionKeys,
          selectedGroup: editingGroup,
          modifiedProviderNames: modifiedSelectionProviders,
        }),
      });
      return true;
    } catch (error) {
      toast({
        title: "Failed to update capability group",
        description: getErrorDescription(error),
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdatingGroup(false);
    }
  }

  async function deleteGroup(groupName: string) {
    try {
      setIsDeletingGroup(true);
      await deleteCapabilityGroup(groupName);
      return true;
    } catch (error) {
      toast({
        title: "Failed to delete capability group",
        description: getErrorDescription(error),
        variant: "destructive",
      });
      return false;
    } finally {
      setIsDeletingGroup(false);
    }
  }

  return {
    providers,
    groups,
    visibleProviders,
    searchQuery,
    setSearchQuery,
    annotationFilter,
    setAnnotationFilter,
    expandedProviders,
    expandProviderSections,
    clearProviderExpansion,
    toggleProviderExpansion,
    selectedGroupName,
    selectedGroup,
    selectGroup,
    selectedCapabilityKeys,
    setSelectedCapabilityKeys,
    toggleCapabilitySelection,
    startCreatingGroup,
    startEditingGroup,
    editingGroup,
    createGroup,
    updateEditingGroup,
    deleteGroup,
    createGroupError,
    editGroupError,
    isCreatingGroup,
    isUpdatingGroup,
    isDeletingGroup,
    dismissToasts: dismiss,
  };
}
