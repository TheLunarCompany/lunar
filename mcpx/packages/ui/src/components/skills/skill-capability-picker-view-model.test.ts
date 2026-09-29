import { describe, expect, it } from "vitest";

import type { CapabilityProvider } from "@/components/capabilities/types";
import { buildSkillCapabilitySelectionKey } from "@/mapping/skill-capabilities";

import {
  buildSelectedProviderNames,
  buildSkillCapabilityPickerViewModel,
  collapsedDescriptionLength,
  type BuildSkillCapabilityPickerViewModelInput,
} from "./skill-capability-picker-view-model";

const githubCatalogItemId = "github-catalog-item";
const playwrightCatalogItemId = "playwright-catalog-item";

const providers: CapabilityProvider[] = [
  {
    name: "github",
    catalogItemId: githubCatalogItemId,
    items: [
      {
        id: "github:search",
        kind: "tool",
        name: "search_repositories",
        description: "Find repositories",
        providerName: "github",
      },
      {
        id: "github:write",
        kind: "prompt",
        name: "write_pull_request",
        description: "x".repeat(collapsedDescriptionLength + 1),
        providerName: "github",
      },
    ],
  },
  {
    name: "playwright",
    catalogItemId: playwrightCatalogItemId,
    items: [
      {
        id: "playwright:shot",
        kind: "tool",
        name: "take_screenshot",
        description: "Capture a screenshot",
        providerName: "playwright",
      },
    ],
  },
];

const githubSearchKey = buildSkillCapabilitySelectionKey(
  githubCatalogItemId,
  "tool",
  "search_repositories",
);

function build(
  overrides: Partial<BuildSkillCapabilityPickerViewModelInput> = {},
) {
  return buildSkillCapabilityPickerViewModel({
    providers,
    providerFilters: [],
    query: "",
    selectedKeys: new Set(),
    expandedProviderNames: new Set(),
    collapsedProviderNames: new Set(),
    unavailableProviderNames: new Set(),
    unavailableProviderDescriptions: new Map(),
    ...overrides,
  });
}

describe("buildSkillCapabilityPickerViewModel", () => {
  it("reports emptyReason for no providers and no search matches", () => {
    expect(build({ providers: [] }).emptyReason).toBe("no-providers");
    expect(build({ query: "does-not-exist" }).emptyReason).toBe("no-matches");
    expect(build().emptyReason).toBeNull();
  });

  it("filters by query across provider name, item name, and description", () => {
    const byItemName = build({ query: "take_screenshot" });
    expect(byItemName.providerRows.map((row) => row.name)).toEqual([
      "playwright",
    ]);
    expect(byItemName.isSearching).toBe(true);

    const byDescription = build({ query: "find repositories" });
    expect(byDescription.providerRows.map((row) => row.name)).toEqual([
      "github",
    ]);
  });

  it("restricts providers to the active provider filter", () => {
    const model = build({ providerFilters: ["playwright"] });
    expect(model.isFilteringProvider).toBe(true);
    expect(model.providerRows.map((row) => row.name)).toEqual(["playwright"]);
  });

  it("derives an indeterminate provider selection state from a partial selection", () => {
    const model = build({ selectedKeys: new Set([githubSearchKey]) });
    const github = model.providerRows.find((row) => row.name === "github");

    expect(github?.selectionState).toBe("indeterminate");
    expect(github?.selectedCount).toBe(1);
    expect(github?.itemCount).toBe(2);
    expect(github?.toolRows[0]?.isSelected).toBe(true);
  });

  it("auto-expands while searching or filtering unless the provider was collapsed", () => {
    expect(
      build({ expandedProviderNames: new Set() }).providerRows[0]?.isExpanded,
    ).toBe(false);
    expect(
      build({ expandedProviderNames: new Set(["github"]) }).providerRows.find(
        (row) => row.name === "github",
      )?.isExpanded,
    ).toBe(true);
    expect(build({ query: "github" }).providerRows[0]?.isExpanded).toBe(true);
    expect(
      build({
        query: "github",
        collapsedProviderNames: new Set(["github"]),
      }).providerRows[0]?.isExpanded,
    ).toBe(false);
    expect(
      build({
        providerFilters: ["github"],
        collapsedProviderNames: new Set(["github"]),
      }).providerRows[0]?.isExpanded,
    ).toBe(false);
  });

  it("marks long descriptions as clampable and unavailable providers as disabled", () => {
    const model = build({ unavailableProviderNames: new Set(["playwright"]) });

    const longPrompt = model.providerRows
      .find((row) => row.name === "github")
      ?.promptRows.find((row) => row.item.name === "write_pull_request");
    expect(longPrompt?.shouldClampDescription).toBe(true);

    const playwright = model.providerRows.find(
      (row) => row.name === "playwright",
    );
    expect(playwright?.isUnavailable).toBe(true);
    expect(playwright?.isSelectionDisabled).toBe(true);
    expect(playwright?.toolRows[0]?.isDisabled).toBe(true);
  });
});

describe("buildSelectedProviderNames", () => {
  it("returns provider names that have at least one selected item", () => {
    expect(buildSelectedProviderNames(providers, new Set())).toEqual(new Set());
    expect(
      buildSelectedProviderNames(providers, new Set([githubSearchKey])),
    ).toEqual(new Set(["github"]));
  });
});
