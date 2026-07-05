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
