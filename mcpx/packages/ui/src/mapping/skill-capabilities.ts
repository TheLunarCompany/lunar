import type { SkillCapabilityGroup, SystemState } from "@mcpx/shared-model";
import type { CatalogMCPServerConfigByNameList } from "@mcpx/toolkit-ui/src/utils/server-helpers";

import type {
  CapabilityItem,
  CapabilityProvider,
} from "@/components/capabilities/types";

export type SkillCapabilityKind = "tool" | "prompt";
export type SkillCapabilitySelectionKey =
  `${string}:${SkillCapabilityKind}:${string}`;

export type LinkedCapabilityProvider = {
  provider: CapabilityProvider;
  selectedCount: number;
};

type SkillCapabilityGroupItem = SkillCapabilityGroup["items"][number];

const unavailableReason =
  "Saved on this skill but no longer available from this MCP server.";

export function buildSkillCapabilitySelectionKey(
  catalogItemId: string,
  kind: SkillCapabilityKind,
  itemName: string,
): SkillCapabilitySelectionKey {
  return `${encodeURIComponent(catalogItemId)}:${kind}:${encodeURIComponent(itemName)}`;
}

export function splitSkillCapabilitySelectionKey(
  key: SkillCapabilitySelectionKey,
): {
  catalogItemId: string;
  kind: SkillCapabilityKind;
  itemName: string;
} {
  const [encodedCatalogItemId, kind, encodedItemName] = key.split(":");

  if (
    !encodedCatalogItemId ||
    (kind !== "tool" && kind !== "prompt") ||
    !encodedItemName
  ) {
    throw new Error(`Invalid skill capability selection key: ${key}`);
  }

  return {
    catalogItemId: decodeURIComponent(encodedCatalogItemId),
    kind,
    itemName: decodeURIComponent(encodedItemName),
  };
}

export function getCapabilityProviderSelectionId(provider: CapabilityProvider) {
  return provider.catalogItemId ?? provider.name;
}

export function getCapabilityItemSelectionName(item: CapabilityItem) {
  return item.selectionName ?? item.name;
}

export function buildSkillCapabilityGroupFromSelection(args: {
  selectedKeys: Set<SkillCapabilitySelectionKey>;
  providers: CapabilityProvider[];
}): SkillCapabilityGroup | undefined {
  const selectedItemsByCatalogItemId = buildSelectedItemsByCatalogItemId(
    args.selectedKeys,
  );
  const catalogItemIdsInProviderOrder = args.providers
    .map((provider) => provider.catalogItemId)
    .filter((catalogItemId): catalogItemId is string => Boolean(catalogItemId));
  const selectableCatalogItemIds = new Set(catalogItemIdsInProviderOrder);
  const orderedCatalogItemIds = [
    ...catalogItemIdsInProviderOrder,
    ...[...selectedItemsByCatalogItemId.keys()].filter(
      (catalogItemId) => !selectableCatalogItemIds.has(catalogItemId),
    ),
  ];
  const items: SkillCapabilityGroup["items"] = [];

  for (const catalogItemId of orderedCatalogItemIds) {
    if (!selectableCatalogItemIds.has(catalogItemId)) {
      continue;
    }

    const selectedItems = selectedItemsByCatalogItemId.get(catalogItemId);
    const item = {
      catalogItemId,
      tools: buildSelectionValue(selectedItems?.tools ?? new Set<string>()),
      prompts: buildSelectionValue(selectedItems?.prompts ?? new Set<string>()),
    };

    if (hasSelectedCapability(item)) {
      items.push(item);
    }
  }

  return items.length > 0 ? { items } : undefined;
}

export function deriveSkillCapabilitySelectionState(args: {
  capabilityGroup?: SkillCapabilityGroup;
  providers: CapabilityProvider[];
}): {
  selectedKeys: Set<SkillCapabilitySelectionKey>;
} {
  const selectedKeys = new Set<SkillCapabilitySelectionKey>();
  const providersByCatalogItemId = new Map(
    args.providers
      .filter((provider) => provider.catalogItemId)
      .map((provider) => [provider.catalogItemId, provider]),
  );

  for (const item of args.capabilityGroup?.items ?? []) {
    const provider = providersByCatalogItemId.get(item.catalogItemId);
    if (!provider) {
      continue;
    }

    addSelectedKeysForCapabilityItems({
      selectedKeys,
      catalogItemId: item.catalogItemId,
      provider,
      kind: "tool",
      selection: item.tools,
    });
    addSelectedKeysForCapabilityItems({
      selectedKeys,
      catalogItemId: item.catalogItemId,
      provider,
      kind: "prompt",
      selection: item.prompts,
    });
  }

  return { selectedKeys };
}

export function buildLinkedCapabilityProviders(args: {
  providers: CapabilityProvider[];
  selectedKeys: Set<SkillCapabilitySelectionKey>;
}): LinkedCapabilityProvider[] {
  return args.providers
    .map((provider) => ({
      provider,
      selectedCount: countSelectedProviderKeys(provider, args.selectedKeys),
    }))
    .filter(({ selectedCount }) => selectedCount > 0);
}

export function addUnavailableSavedSkillCapabilities(args: {
  capabilityGroup?: SkillCapabilityGroup;
  targetServers: SystemState["targetServers"];
  providers: CapabilityProvider[];
  catalogItems?: CatalogMCPServerConfigByNameList;
}): CapabilityProvider[] {
  const providers = args.providers.map((provider) => ({
    ...provider,
    items: [...provider.items],
  }));
  const providersByCatalogItemId = new Map(
    providers
      .filter((provider) => provider.catalogItemId)
      .map((provider) => [provider.catalogItemId, provider]),
  );
  const catalogItemsById = new Map(
    (args.catalogItems ?? []).map((item) => [item.id, item]),
  );
  const serversByCatalogItemId = new Map(
    args.targetServers
      .filter((server) => server.catalogItemId)
      .map((server) => [server.catalogItemId, server]),
  );

  for (const item of args.capabilityGroup?.items ?? []) {
    const provider = providersByCatalogItemId.get(item.catalogItemId);

    if (!provider) {
      providers.push({
        name:
          getCatalogItemLabel(catalogItemsById.get(item.catalogItemId)) ??
          item.catalogItemId,
        catalogItemId: item.catalogItemId,
        items: buildUnavailableCapabilityItems({
          providerName:
            getCatalogItemLabel(catalogItemsById.get(item.catalogItemId)) ??
            item.catalogItemId,
          item,
        }),
      });
      continue;
    }

    provider.items.push(
      ...buildUnavailableCapabilityItems({
        providerName: provider.name,
        item: {
          catalogItemId: item.catalogItemId,
          tools: findUnavailableSelectionNames({
            selection: item.tools,
            visibleNames: buildVisibleNames(provider, "tool"),
            serverNames: serversByCatalogItemId
              .get(item.catalogItemId)
              ?.tools.map((tool) => tool.name),
          }),
          prompts: findUnavailableSelectionNames({
            selection: item.prompts,
            visibleNames: buildVisibleNames(provider, "prompt"),
            serverNames: serversByCatalogItemId
              .get(item.catalogItemId)
              ?.prompts?.map((prompt) => prompt.name),
          }),
        },
      }),
    );
  }

  return providers;
}

function buildUnavailableCapabilityItems({
  providerName,
  item,
}: {
  providerName: string;
  item: SkillCapabilityGroupItem;
}): CapabilityItem[] {
  return [
    ...buildUnavailableCapabilityItemsForKind({
      providerName,
      catalogItemId: item.catalogItemId,
      kind: "tool",
      values: item.tools,
    }),
    ...buildUnavailableCapabilityItemsForKind({
      providerName,
      catalogItemId: item.catalogItemId,
      kind: "prompt",
      values: item.prompts,
    }),
  ];
}

function buildUnavailableCapabilityItemsForKind({
  providerName,
  catalogItemId,
  kind,
  values,
}: {
  providerName: string;
  catalogItemId: string;
  kind: SkillCapabilityKind;
  values: SkillCapabilityGroupItem["tools"];
}): CapabilityItem[] {
  if (values === "*") {
    return [
      {
        id: `${catalogItemId}:${kind}:*`,
        kind,
        name: "All",
        selectionName: "*",
        description: "",
        unavailableReason,
        providerName,
      },
    ];
  }

  return values.map((name) => ({
    id: `${catalogItemId}:${kind}:${name}`,
    kind,
    name,
    description: "",
    unavailableReason,
    providerName,
  }));
}

function buildVisibleNames(
  provider: CapabilityProvider,
  kind: SkillCapabilityKind,
) {
  return new Set(
    provider.items
      .filter((item) => item.kind === kind)
      .map(getCapabilityItemSelectionName),
  );
}

function findUnavailableSelectionNames({
  selection,
  visibleNames,
  serverNames = [],
}: {
  selection: SkillCapabilityGroupItem["tools"];
  visibleNames: Set<string>;
  serverNames?: string[];
}) {
  if (selection === "*") {
    return [];
  }

  const availableNames = new Set([...visibleNames, ...serverNames]);
  return selection.filter((name) => !availableNames.has(name)).sort();
}

function buildSelectedItemsByCatalogItemId(
  selectedKeys: Set<SkillCapabilitySelectionKey>,
): Map<string, { tools: Set<string>; prompts: Set<string> }> {
  const selectedItemsByCatalogItemId = new Map<
    string,
    { tools: Set<string>; prompts: Set<string> }
  >();

  for (const key of selectedKeys) {
    const { catalogItemId, kind, itemName } =
      splitSkillCapabilitySelectionKey(key);
    const selectedItems = selectedItemsByCatalogItemId.get(catalogItemId) ?? {
      tools: new Set<string>(),
      prompts: new Set<string>(),
    };

    if (kind === "tool") {
      selectedItems.tools.add(itemName);
    } else {
      selectedItems.prompts.add(itemName);
    }

    selectedItemsByCatalogItemId.set(catalogItemId, selectedItems);
  }

  return selectedItemsByCatalogItemId;
}

function buildSelectionValue(
  selectedNames: Set<string>,
): SkillCapabilityGroupItem["tools"] {
  if (selectedNames.has("*")) {
    return "*";
  }

  return [...selectedNames].sort();
}

function hasSelectedCapability(item: SkillCapabilityGroupItem) {
  return (
    item.tools === "*" ||
    item.prompts === "*" ||
    item.tools.length > 0 ||
    item.prompts.length > 0
  );
}

function addSelectedKeysForCapabilityItems(args: {
  selectedKeys: Set<SkillCapabilitySelectionKey>;
  catalogItemId: string;
  provider: CapabilityProvider;
  kind: SkillCapabilityKind;
  selection: SkillCapabilityGroupItem["tools"];
}): void {
  const visibleItems = args.provider.items.filter(
    (item) => item.kind === args.kind,
  );

  if (args.selection === "*") {
    args.selectedKeys.add(
      buildSkillCapabilitySelectionKey(args.catalogItemId, args.kind, "*"),
    );
  }

  const selectedItemNames =
    args.selection === "*" ? undefined : new Set(args.selection);

  for (const item of visibleItems) {
    const itemName = getCapabilityItemSelectionName(item);
    if (selectedItemNames && !selectedItemNames.has(itemName)) {
      continue;
    }

    args.selectedKeys.add(
      buildSkillCapabilitySelectionKey(args.catalogItemId, args.kind, itemName),
    );
  }
}

function getCatalogItemLabel(
  item: CatalogMCPServerConfigByNameList[number] | undefined,
) {
  return item?.displayName || item?.name;
}

function countSelectedProviderKeys(
  provider: CapabilityProvider,
  selectedKeys: Set<SkillCapabilitySelectionKey>,
) {
  const providerSelectionId = getCapabilityProviderSelectionId(provider);

  return [...selectedKeys].filter(
    (key) =>
      splitSkillCapabilitySelectionKey(key).catalogItemId ===
      providerSelectionId,
  ).length;
}
