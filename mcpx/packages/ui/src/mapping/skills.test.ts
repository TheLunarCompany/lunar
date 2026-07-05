import type { AppConfig, SystemState } from "@mcpx/shared-model";
import { describe, expect, it } from "vitest";
import { buildSkillToolGroupOptions } from "./skills";

describe("buildSkillToolGroupOptions", () => {
  it("maps config tool groups to skill tool groups with catalog item IDs", () => {
    const options = buildSkillToolGroupOptions({
      appConfig: appConfigWithToolGroups([
        {
          name: "Repository tools",
          description: "GitHub access",
          services: {
            github: ["pull_request_read", "issues_read"],
            filesystem: "*",
          },
        },
      ]),
      systemState: systemStateWithTargetServers([
        targetServer("github", "0190a000-0000-7000-8000-000000000010"),
        targetServer("filesystem", "0190a000-0000-7000-8000-000000000011", [
          "read",
          "write",
        ]),
      ]),
    });

    expect(options).toEqual([
      {
        id: "Repository tools",
        name: "Repository tools",
        description: "GitHub access",
        capabilityGroup: {
          name: "Repository tools",
          items: [
            {
              catalogItemId: "0190a000-0000-7000-8000-000000000010",
              tools: ["pull_request_read", "issues_read"],
              prompts: [],
            },
            {
              catalogItemId: "0190a000-0000-7000-8000-000000000011",
              tools: "*",
              prompts: [],
            },
          ],
        },
        providers: [
          { providerName: "github", itemCount: 2 },
          { providerName: "filesystem", itemCount: 2 },
        ],
      },
    ]);
  });

  it("marks a config tool group unavailable when a server has no catalog item ID", () => {
    const options = buildSkillToolGroupOptions({
      appConfig: appConfigWithToolGroups([
        {
          name: "Local tools",
          services: {
            local: "*",
          },
        },
      ]),
      systemState: systemStateWithTargetServers([targetServer("local")]),
    });

    expect(options).toEqual([
      {
        id: "Local tools",
        name: "Local tools",
        disabledReason: "Missing catalog item ID for local.",
      },
    ]);
  });
});

function appConfigWithToolGroups(
  toolGroups: AppConfig["toolGroups"],
): AppConfig {
  return {
    permissions: {
      default: { _type: "default-block", allow: [] },
      consumers: {},
      clientNames: {},
    },
    toolGroups,
    auth: { enabled: false },
    toolExtensions: { services: {} },
    targetServerAttributes: {},
    staticOauth: undefined,
  };
}

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
    usage: { callCount: 0 },
  };
}
