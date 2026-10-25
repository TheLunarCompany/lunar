import type { SystemState } from "@mcpx/shared-model";
import { describe, expect, it } from "vitest";

import type { CapabilityProvider } from "@/components/capabilities/types";

import {
  addUnavailableSavedSkillCapabilities,
  buildLinkedCapabilityProviders,
  buildSkillCapabilityGroupFromSelection,
  buildSkillCapabilitySelectionKey,
  deriveSkillCapabilitySelectionState,
  splitSkillCapabilitySelectionKey,
} from "./skill-capabilities";

describe("skill capability mapping", () => {
  it("round-trips catalog item IDs and item names containing colons or spaces", () => {
    expect(
      splitSkillCapabilitySelectionKey(
        buildSkillCapabilitySelectionKey("catalog:item", "tool", "run:tool"),
      ),
    ).toEqual({
      catalogItemId: "catalog:item",
      kind: "tool",
      itemName: "run:tool",
    });
  });

  it("builds one payload item per selected catalog item with separate tools and prompts", () => {
    const githubCatalogItemId = "0190a000-0000-7000-8000-000000000010";
    const linearCatalogItemId = "0190a000-0000-7000-8000-000000000011";

    const capabilityGroup = buildSkillCapabilityGroupFromSelection({
      selectedKeys: new Set([
        buildSkillCapabilitySelectionKey(
          githubCatalogItemId,
          "tool",
          "create_issue",
        ),
        buildSkillCapabilitySelectionKey(
          githubCatalogItemId,
          "prompt",
          "issue_template",
        ),
        buildSkillCapabilitySelectionKey(
          linearCatalogItemId,
          "tool",
          "create_ticket",
        ),
      ]),
      providers: [
        capabilityProvider({
          name: "github",
          catalogItemId: githubCatalogItemId,
          tools: ["search_repositories", "create_issue"],
          prompts: ["issue_template", "release_notes"],
        }),
        capabilityProvider({
          name: "linear",
          catalogItemId: linearCatalogItemId,
          tools: ["create_ticket"],
          prompts: [],
        }),
      ],
    });

    expect(capabilityGroup).toEqual({
      items: [
        {
          catalogItemId: githubCatalogItemId,
          tools: ["create_issue"],
          prompts: ["issue_template"],
        },
        {
          catalogItemId: linearCatalogItemId,
          tools: ["create_ticket"],
          prompts: [],
        },
      ],
    });
    expect(capabilityGroup?.items[0]).not.toHaveProperty("name");
  });

  it("returns undefined for empty selection", () => {
    expect(
      buildSkillCapabilityGroupFromSelection({
        selectedKeys: new Set(),
        providers: [
          capabilityProvider({
            name: "github",
            catalogItemId: "0190a000-0000-7000-8000-000000000010",
            tools: ["create_issue"],
            prompts: [],
          }),
        ],
      }),
    ).toBeUndefined();
  });

  it("ignores selected providers without catalog item IDs", () => {
    expect(
      buildSkillCapabilityGroupFromSelection({
        selectedKeys: new Set([
          buildSkillCapabilitySelectionKey("local", "tool", "inspect"),
        ]),
        providers: [
          capabilityProvider({
            name: "local",
            tools: ["inspect"],
            prompts: [],
          }),
        ],
      }),
    ).toBeUndefined();
  });

  it("keeps wildcard selections while their wildcard key is selected", () => {
    const catalogItemId = "0190a000-0000-7000-8000-000000000010";

    expect(
      buildSkillCapabilityGroupFromSelection({
        selectedKeys: new Set([
          buildSkillCapabilitySelectionKey(catalogItemId, "tool", "*"),
          buildSkillCapabilitySelectionKey(
            catalogItemId,
            "tool",
            "create_issue",
          ),
          buildSkillCapabilitySelectionKey(
            catalogItemId,
            "tool",
            "search_repositories",
          ),
        ]),
        providers: [
          capabilityProvider({
            name: "github",
            catalogItemId,
            tools: ["create_issue", "search_repositories"],
            prompts: [],
          }),
        ],
      }),
    ).toEqual({
      items: [
        {
          catalogItemId,
          tools: "*",
          prompts: [],
        },
      ],
    });
  });

  it("hydrates explicit tools and prompts into visible selected keys", () => {
    const catalogItemId = "0190a000-0000-7000-8000-000000000010";
    const state = deriveSkillCapabilitySelectionState({
      capabilityGroup: {
        items: [
          {
            catalogItemId,
            tools: ["create_issue"],
            prompts: ["issue_template"],
          },
        ],
      },
      providers: [
        capabilityProvider({
          name: "github",
          catalogItemId,
          tools: ["create_issue", "search_repositories"],
          prompts: ["issue_template", "release_notes"],
        }),
      ],
    });

    expect(state.selectedKeys).toEqual(
      new Set([
        buildSkillCapabilitySelectionKey(catalogItemId, "tool", "create_issue"),
        buildSkillCapabilitySelectionKey(
          catalogItemId,
          "prompt",
          "issue_template",
        ),
      ]),
    );
  });

  it("hydrates wildcard tools and prompts into wildcard and visible selected keys", () => {
    const catalogItemId = "0190a000-0000-7000-8000-000000000010";
    const state = deriveSkillCapabilitySelectionState({
      capabilityGroup: {
        items: [
          {
            catalogItemId,
            tools: "*",
            prompts: "*",
          },
        ],
      },
      providers: [
        capabilityProvider({
          name: "github",
          catalogItemId,
          tools: ["create_issue", "search_repositories"],
          prompts: ["issue_template", "release_notes"],
        }),
      ],
    });

    expect(state.selectedKeys).toEqual(
      new Set([
        buildSkillCapabilitySelectionKey(catalogItemId, "tool", "*"),
        buildSkillCapabilitySelectionKey(catalogItemId, "tool", "create_issue"),
        buildSkillCapabilitySelectionKey(
          catalogItemId,
          "tool",
          "search_repositories",
        ),
        buildSkillCapabilitySelectionKey(catalogItemId, "prompt", "*"),
        buildSkillCapabilitySelectionKey(
          catalogItemId,
          "prompt",
          "issue_template",
        ),
        buildSkillCapabilitySelectionKey(
          catalogItemId,
          "prompt",
          "release_notes",
        ),
      ]),
    );
  });

  it("adds unavailable saved items to existing providers", () => {
    const catalogItemId = "0190a000-0000-7000-8000-000000000010";
    const providers = addUnavailableSavedSkillCapabilities({
      capabilityGroup: {
        items: [
          {
            catalogItemId,
            tools: ["archived_tool", "create_issue"],
            prompts: ["archived_prompt"],
          },
        ],
      },
      targetServers: [
        targetServer({
          name: "github",
          catalogItemId,
          toolNames: ["create_issue"],
        }),
      ],
      providers: [
        capabilityProvider({
          name: "github",
          catalogItemId,
          tools: ["create_issue"],
          prompts: [],
        }),
      ],
    });

    expect(providers).toEqual([
      expect.objectContaining({
        name: "github",
        catalogItemId,
        items: expect.arrayContaining([
          expect.objectContaining({
            kind: "tool",
            name: "archived_tool",
            unavailableReason:
              "Saved on this skill but no longer available from this MCP server.",
          }),
          expect.objectContaining({
            kind: "prompt",
            name: "archived_prompt",
            unavailableReason:
              "Saved on this skill but no longer available from this MCP server.",
          }),
        ]),
      }),
    ]);
  });

  it("adds missing saved servers using catalog display names", () => {
    const missingCatalogItemId = "0190a000-0000-7000-8000-000000000099";
    const providers = addUnavailableSavedSkillCapabilities({
      capabilityGroup: {
        items: [
          {
            catalogItemId: missingCatalogItemId,
            tools: ["archived_tool"],
            prompts: "*",
          },
        ],
      },
      targetServers: [],
      providers: [],
      catalogItems: [
        {
          id: missingCatalogItemId,
          name: "coda",
          displayName: "Coda",
          config: {},
        },
      ],
    });

    expect(providers).toEqual([
      {
        name: "Coda",
        catalogItemId: missingCatalogItemId,
        items: [
          expect.objectContaining({
            kind: "tool",
            name: "archived_tool",
            providerName: "Coda",
          }),
          expect.objectContaining({
            kind: "prompt",
            name: "All",
            selectionName: "*",
            providerName: "Coda",
          }),
        ],
      },
    ]);
  });

  it("builds linked provider summaries from selected capability keys", () => {
    const githubCatalogItemId = "0190a000-0000-7000-8000-000000000010";
    const linkedProviders = buildLinkedCapabilityProviders({
      providers: [
        capabilityProvider({
          name: "github",
          catalogItemId: githubCatalogItemId,
          tools: ["search_repositories", "create_issue"],
          prompts: ["write_pull_request"],
        }),
        capabilityProvider({
          name: "linear",
          catalogItemId: "0190a000-0000-7000-8000-000000000011",
          tools: ["list_issues"],
          prompts: [],
        }),
      ],
      selectedKeys: new Set([
        buildSkillCapabilitySelectionKey(
          githubCatalogItemId,
          "tool",
          "create_issue",
        ),
        buildSkillCapabilitySelectionKey(
          githubCatalogItemId,
          "prompt",
          "write_pull_request",
        ),
      ]),
    });

    expect(linkedProviders).toEqual([
      expect.objectContaining({
        provider: expect.objectContaining({ name: "github" }),
        selectedCount: 2,
      }),
    ]);
  });
});

function targetServer({
  name,
  catalogItemId,
  toolNames = [],
  promptNames = [],
}: {
  name: string;
  catalogItemId?: string;
  toolNames?: string[];
  promptNames?: string[];
}): SystemState["targetServers"][number] {
  return {
    _type: "stdio",
    name,
    catalogItemId,
    command: "npx",
    state: { type: "connected" },
    tools: toolNames.map((toolName) => ({
      name: toolName,
      usage: { callCount: 0 },
      inputSchema: { type: "object" },
    })),
    originalTools: [],
    prompts: promptNames.map((promptName) => ({
      name: promptName,
      usage: { callCount: 0 },
    })),
    originalPrompts: [],
    usage: { callCount: 0 },
  };
}

function capabilityProvider({
  name,
  catalogItemId,
  tools,
  prompts,
}: {
  name: string;
  catalogItemId?: string;
  tools: string[];
  prompts: string[];
}): CapabilityProvider {
  return {
    name,
    catalogItemId,
    items: [
      ...tools.map((toolName) => ({
        id: `${name}:tool:${toolName}`,
        kind: "tool" as const,
        name: toolName,
        description: "",
        providerName: name,
      })),
      ...prompts.map((promptName) => ({
        id: `${name}:prompt:${promptName}`,
        kind: "prompt" as const,
        name: promptName,
        description: "",
        providerName: name,
      })),
    ],
  };
}
