import type { SkillCapabilityGroup, SystemState } from "@mcpx/shared-model";
import type { CatalogMCPServerConfigByNameList } from "@mcpx/toolkit-ui/src/utils/server-helpers";

export type SkillCardCapabilitySummary = {
  providers: string[];
  toolsCount: number;
  promptsCount: number;
};

// Skills store their capability group by `catalogItemId`, while the UI shows
// server names/icons. Resolve each item's catalog id back to the currently
// connected target server's name. Ids that don't map to a connected server are
// dropped (there's no name/icon to show). Order is preserved and de-duped.
export function buildSkillProviderNameResolver(
  systemState: SystemState | null | undefined,
  catalogItems?: CatalogMCPServerConfigByNameList,
): (capabilityGroup?: SkillCapabilityGroup) => string[] {
  const summarize = buildSkillCardCapabilitySummaryResolver(
    systemState,
    catalogItems,
  );
  return (capabilityGroup) => summarize(capabilityGroup).providers;
}

export function resolveSkillProviderNames({
  capabilityGroup,
  systemState,
  catalogItems,
}: {
  capabilityGroup?: SkillCapabilityGroup;
  systemState: SystemState | null | undefined;
  catalogItems?: CatalogMCPServerConfigByNameList;
}): string[] {
  return buildSkillProviderNameResolver(
    systemState,
    catalogItems,
  )(capabilityGroup);
}

export function buildSkillCardCapabilitySummaryResolver(
  systemState: SystemState | null | undefined,
  catalogItems?: CatalogMCPServerConfigByNameList,
): (capabilityGroup?: SkillCapabilityGroup) => SkillCardCapabilitySummary {
  const serverByCatalogItemId = new Map(
    (systemState?.targetServers ?? [])
      .filter((server) => server.catalogItemId)
      .map((server) => [server.catalogItemId, server]),
  );
  const catalogItemById = new Map(
    (catalogItems ?? []).map((item) => [item.id, item]),
  );

  return (capabilityGroup) => {
    const summary: SkillCardCapabilitySummary = {
      providers: [],
      toolsCount: 0,
      promptsCount: 0,
    };
    const seenProviderNames = new Set<string>();

    for (const item of capabilityGroup?.items ?? []) {
      const server = serverByCatalogItemId.get(item.catalogItemId);
      const providerName =
        server?.name ??
        getCatalogItemLabel(catalogItemById.get(item.catalogItemId));
      if (providerName && !seenProviderNames.has(providerName)) {
        seenProviderNames.add(providerName);
        summary.providers.push(providerName);
      }

      summary.toolsCount += countCapabilitySelection(
        item.tools,
        server?.tools.length ?? 0,
      );
      summary.promptsCount += countCapabilitySelection(
        item.prompts,
        server?.prompts?.length ?? 0,
      );
    }

    return summary;
  };
}

function getCatalogItemLabel(
  item: CatalogMCPServerConfigByNameList[number] | undefined,
) {
  return item?.name || item?.displayName;
}

function countCapabilitySelection(
  selection: string[] | "*",
  wildcardCount: number,
) {
  return selection === "*" ? wildcardCount : selection.length;
}
