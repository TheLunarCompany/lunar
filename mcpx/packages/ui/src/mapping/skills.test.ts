import type { SystemState } from "@mcpx/shared-model";
import type { CatalogMCPServerConfigByNameList } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { describe, expect, it } from "vitest";
import {
  buildSkillCardCapabilitySummaryResolver,
  resolveSkillProviderNames,
} from "./skills";

describe("resolveSkillProviderNames", () => {
  it("resolves catalog item ids to connected server names, de-duped and ordered", () => {
    const names = resolveSkillProviderNames({
      capabilityGroup: {
        name: "Repository",
        items: [
          { catalogItemId: "cat-github", tools: ["read"], prompts: [] },
          { catalogItemId: "cat-linear", tools: "*", prompts: [] },
          { catalogItemId: "cat-github", tools: ["write"], prompts: [] },
        ],
      },
      systemState: systemStateWithTargetServers([
        targetServer("github", "cat-github"),
        targetServer("linear", "cat-linear"),
      ]),
    });

    expect(names).toEqual(["github", "linear"]);
  });

  it("drops catalog item ids with no matching connected server", () => {
    const names = resolveSkillProviderNames({
      capabilityGroup: {
        name: "Repository",
        items: [
          { catalogItemId: "cat-github", tools: ["read"], prompts: [] },
          { catalogItemId: "cat-missing", tools: ["read"], prompts: [] },
        ],
      },
      systemState: systemStateWithTargetServers([
        targetServer("github", "cat-github"),
      ]),
    });

    expect(names).toEqual(["github"]);
  });

  it("resolves missing connected servers from catalog items", () => {
    const names = resolveSkillProviderNames({
      capabilityGroup: {
        name: "Disconnected",
        items: [
          { catalogItemId: "cat-time", tools: ["convert_time"], prompts: [] },
          { catalogItemId: "cat-coda", tools: ["list_documents"], prompts: [] },
        ],
      },
      systemState: systemStateWithTargetServers([]),
      catalogItems: [
        catalogItem("cat-time", "time", "Time"),
        catalogItem("cat-coda", "coda", "Coda"),
      ],
    });

    expect(names).toEqual(["time", "coda"]);
  });

  it("returns an empty list when the skill has no capability group", () => {
    expect(
      resolveSkillProviderNames({
        capabilityGroup: undefined,
        systemState: systemStateWithTargetServers([
          targetServer("github", "cat-github"),
        ]),
      }),
    ).toEqual([]);
  });
});

describe("buildSkillCardCapabilitySummaryResolver", () => {
  it("counts wildcard tool and prompt selections from the matching target server", () => {
    const summarize = buildSkillCardCapabilitySummaryResolver(
      systemStateWithTargetServers([
        targetServer(
          "filesystem",
          "cat-filesystem",
          ["read_file", "write_file"],
          ["summarize_file"],
        ),
      ]),
    );

    expect(
      summarize({
        name: "Filesystem",
        items: [
          {
            catalogItemId: "cat-filesystem",
            tools: "*",
            prompts: "*",
          },
        ],
      }),
    ).toEqual({
      providers: ["filesystem"],
      toolsCount: 2,
      promptsCount: 1,
    });
  });

  it("keeps providers visible from catalog items when target servers are disconnected", () => {
    const summarize = buildSkillCardCapabilitySummaryResolver(
      systemStateWithTargetServers([]),
      [catalogItem("cat-time", "time", "Time")],
    );

    expect(
      summarize({
        name: "Disconnected",
        items: [
          {
            catalogItemId: "cat-time",
            tools: ["convert_time"],
            prompts: [],
          },
        ],
      }),
    ).toEqual({
      providers: ["time"],
      toolsCount: 1,
      promptsCount: 0,
    });
  });
});

function systemStateWithTargetServers(
  targetServers: SystemState["targetServers"],
): SystemState {
  return {
    targetServers,
    connectedClients: [],
    connectedClientClusters: [],
    usage: { callCount: 0 },
    lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function targetServer(
  name: string,
  catalogItemId?: string,
  tools: string[] = [],
  prompts: string[] = [],
): SystemState["targetServers"][number] {
  return {
    _type: "stdio",
    name,
    catalogItemId,
    command: "npx",
    state: { type: "connected" },
    tools: tools.map((toolName) => ({
      name: toolName,
      usage: { callCount: 0 },
      inputSchema: { type: "object" },
    })),
    originalTools: [],
    prompts: prompts.map((promptName) => ({
      name: promptName,
      usage: { callCount: 0 },
      messages: [],
    })),
    originalPrompts: [],
    usage: { callCount: 0 },
  };
}

function catalogItem(
  id: string,
  name: string,
  displayName?: string,
): CatalogMCPServerConfigByNameList[number] {
  return {
    id,
    name,
    displayName: displayName ?? name,
    description: undefined,
    config: { [name]: { type: "stdio", command: "npx", args: [] } },
  };
}
