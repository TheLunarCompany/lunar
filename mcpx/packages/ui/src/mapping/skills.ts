import type {
  AppConfig,
  SkillCapabilityGroup,
  SystemState,
} from "@mcpx/shared-model";

export type SkillToolGroupOption = {
  id: string;
  name: string;
  description?: string;
  capabilityGroup?: SkillCapabilityGroup;
  providers?: Array<{ providerName: string; itemCount: number }>;
  disabledReason?: string;
};

// Skills store their capability group by `catalogItemId`, while the UI shows
// server names/icons. Resolve each item's catalog id back to the currently
// connected target server's name. Ids that don't map to a connected server are
// dropped (there's no name/icon to show). Order is preserved and de-duped.
export function buildSkillProviderNameResolver(
  systemState: SystemState | null | undefined,
): (capabilityGroup?: SkillCapabilityGroup) => string[] {
  const nameByCatalogItemId = new Map<string, string>();
  for (const server of systemState?.targetServers ?? []) {
    if (server.catalogItemId) {
      nameByCatalogItemId.set(server.catalogItemId, server.name);
    }
  }

  return (capabilityGroup) => {
    const items = capabilityGroup?.items ?? [];
    if (items.length === 0) {
      return [];
    }

    const names: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const name = nameByCatalogItemId.get(item.catalogItemId);
      if (name && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
    return names;
  };
}

export function resolveSkillProviderNames({
  capabilityGroup,
  systemState,
}: {
  capabilityGroup?: SkillCapabilityGroup;
  systemState: SystemState | null | undefined;
}): string[] {
  return buildSkillProviderNameResolver(systemState)(capabilityGroup);
}

export function buildSkillToolGroupOptions({
  appConfig,
  systemState,
}: {
  appConfig: AppConfig | null | undefined;
  systemState: SystemState | null | undefined;
}): SkillToolGroupOption[] {
  const serversByName = new Map(
    (systemState?.targetServers ?? []).map((server) => [server.name, server]),
  );

  return (appConfig?.toolGroups ?? []).map((group) => {
    const missingCatalogServers = Object.keys(group.services).filter(
      (serverName) => !serversByName.get(serverName)?.catalogItemId,
    );

    if (missingCatalogServers.length > 0) {
      return {
        id: group.name,
        name: group.name,
        ...(group.description ? { description: group.description } : {}),
        disabledReason: `Missing catalog item ID for ${missingCatalogServers.join(", ")}.`,
      };
    }

    const items = Object.entries(group.services).map(([serverName, tools]) => {
      const catalogItemId = serversByName.get(serverName)?.catalogItemId;
      if (!catalogItemId) {
        throw new Error(`Missing catalog item ID for ${serverName}.`);
      }

      return {
        catalogItemId,
        tools,
        prompts: [] as string[],
      };
    });

    return {
      id: group.name,
      name: group.name,
      ...(group.description ? { description: group.description } : {}),
      capabilityGroup: {
        name: group.name,
        items,
      },
      providers: Object.entries(group.services).map(([serverName, tools]) => ({
        providerName: serverName,
        itemCount:
          tools === "*"
            ? (serversByName.get(serverName)?.tools.length ?? 0)
            : tools.length,
      })),
    };
  });
}
