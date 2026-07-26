import type { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { describe, expect, it } from "vitest";
import {
  buildInstalledCatalogServerLookup,
  catalogServerMatchesSearch,
  filterAndSortCatalogServers,
  isCatalogServerInstalled,
} from "./catalog-servers";

function catalogServer(
  overrides: Partial<CatalogMCPServerConfigByNameItem> &
    Pick<CatalogMCPServerConfigByNameItem, "id" | "name" | "displayName">,
): CatalogMCPServerConfigByNameItem {
  return {
    config: { [overrides.name]: { command: "cmd", args: [] } },
    description: "",
    ...overrides,
  };
}

describe("catalog-servers mapping", () => {
  it("detects installed servers by catalog item id or name", () => {
    const lookup = buildInstalledCatalogServerLookup([
      { name: "github", catalogItemId: "cat-github" },
      { name: "linear" },
    ]);

    expect(
      isCatalogServerInstalled(
        catalogServer({
          id: "cat-github",
          name: "github",
          displayName: "GitHub",
        }),
        lookup,
      ),
    ).toBe(true);
    expect(
      isCatalogServerInstalled(
        catalogServer({
          id: "cat-linear",
          name: "linear",
          displayName: "Linear",
        }),
        lookup,
      ),
    ).toBe(true);
    expect(
      isCatalogServerInstalled(
        catalogServer({ id: "cat-coda", name: "coda", displayName: "Coda" }),
        lookup,
      ),
    ).toBe(false);
  });

  it("matches search across name, display name, and description", () => {
    const server = catalogServer({
      id: "cat-time",
      name: "time",
      displayName: "Time",
      description: "Convert timestamps",
    });

    expect(catalogServerMatchesSearch(server, "")).toBe(true);
    expect(catalogServerMatchesSearch(server, "time")).toBe(true);
    expect(catalogServerMatchesSearch(server, "convert")).toBe(true);
    expect(catalogServerMatchesSearch(server, "missing")).toBe(false);
  });

  it("sorts uninstalled servers first, then alphabetically", () => {
    const lookup = buildInstalledCatalogServerLookup([
      { name: "beta", catalogItemId: "cat-beta" },
    ]);
    const servers = [
      catalogServer({ id: "cat-beta", name: "beta", displayName: "Beta" }),
      catalogServer({ id: "cat-alpha", name: "alpha", displayName: "Alpha" }),
      catalogServer({ id: "cat-gamma", name: "gamma", displayName: "Gamma" }),
    ];

    expect(
      filterAndSortCatalogServers({
        servers,
        searchQuery: "",
        sortOrder: "asc",
        installedLookup: lookup,
      }).map((server) => server.name),
    ).toEqual(["alpha", "gamma", "beta"]);
  });

  it("reverses alphabetical order when sortOrder is desc", () => {
    const lookup = buildInstalledCatalogServerLookup([]);
    const servers = [
      catalogServer({ id: "cat-alpha", name: "alpha", displayName: "Alpha" }),
      catalogServer({ id: "cat-gamma", name: "gamma", displayName: "Gamma" }),
    ];

    expect(
      filterAndSortCatalogServers({
        servers,
        searchQuery: "",
        sortOrder: "desc",
        installedLookup: lookup,
      }).map((server) => server.name),
    ).toEqual(["gamma", "alpha"]);
  });
});
