import type { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";

export type CatalogSortOrder = "asc" | "desc";

export const CATALOG_SERVER_SORT_OPTIONS: Array<{
  label: string;
  value: CatalogSortOrder;
}> = [
  { label: "A to Z", value: "asc" },
  { label: "Z to A", value: "desc" },
];

export type InstalledCatalogServerLookup = {
  addedItemIds: ReadonlySet<string>;
  addedServerNames: ReadonlySet<string>;
};

export function buildInstalledCatalogServerLookup(
  targetServers: ReadonlyArray<{ name: string; catalogItemId?: string }>,
): InstalledCatalogServerLookup {
  return {
    addedItemIds: new Set(
      targetServers
        .map((server) => server.catalogItemId)
        .filter((id): id is string => Boolean(id)),
    ),
    addedServerNames: new Set(
      targetServers.map((server) => server.name.toLowerCase()),
    ),
  };
}

export function isCatalogServerInstalled(
  server: Pick<CatalogMCPServerConfigByNameItem, "id" | "name">,
  lookup: InstalledCatalogServerLookup,
): boolean {
  return (
    lookup.addedItemIds.has(server.id) ||
    lookup.addedServerNames.has(server.name.toLowerCase())
  );
}

export function catalogServerMatchesSearch(
  server: Pick<
    CatalogMCPServerConfigByNameItem,
    "name" | "displayName" | "description"
  >,
  searchQuery: string,
): boolean {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  if (!normalizedSearch) return true;

  return (
    server.name.toLowerCase().includes(normalizedSearch) ||
    server.displayName.toLowerCase().includes(normalizedSearch) ||
    (server.description ?? "").toLowerCase().includes(normalizedSearch)
  );
}

export function filterAndSortCatalogServers({
  servers,
  searchQuery,
  sortOrder,
  installedLookup,
}: {
  servers: readonly CatalogMCPServerConfigByNameItem[];
  searchQuery: string;
  sortOrder: CatalogSortOrder;
  installedLookup: InstalledCatalogServerLookup;
}): CatalogMCPServerConfigByNameItem[] {
  return [...servers]
    .filter((server) => catalogServerMatchesSearch(server, searchQuery))
    .sort((a, b) => {
      const aIsInstalled = isCatalogServerInstalled(a, installedLookup);
      const bIsInstalled = isCatalogServerInstalled(b, installedLookup);
      if (aIsInstalled !== bIsInstalled) {
        return aIsInstalled ? 1 : -1;
      }

      const comparison = (a.displayName || a.name).localeCompare(
        b.displayName || b.name,
      );
      return sortOrder === "asc" ? comparison : -comparison;
    });
}
