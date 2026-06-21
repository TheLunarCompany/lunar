import { describe, expect, it } from "vitest";
import type { TargetServer, TargetServerTool } from "@mcpx/shared-model";

import {
  buildCapabilityGroupsFromCurrentToolGroups,
  buildCapabilityProvidersFromCurrentTools,
} from "./current-tool-capabilities";
import type { CapabilityItem, CapabilitySelectionKey } from "./types";

function targetServerTool(
  tool: Omit<TargetServerTool, "usage"> &
    Partial<Pick<TargetServerTool, "usage">>,
): TargetServerTool {
  return {
    ...tool,
    usage: tool.usage ?? { callCount: 0 },
  };
}

function targetServer(
  server: Pick<TargetServer, "name" | "tools" | "originalTools"> &
    Partial<TargetServer>,
): TargetServer {
  return {
    _type: "stdio",
    name: server.name,
    state: server.state ?? { type: "connected" },
    command: "node",
    args: [],
    env: {},
    icon: server.icon,
    tools: server.tools,
    originalTools: server.originalTools,
    usage: { callCount: 0 },
  };
}

describe("capability domain types", () => {
  it('supports tool and prompt capability items with current "provider:item" selection keys', () => {
    const toolItem = {
      id: "github:list_repos",
      kind: "tool",
      name: "list_repos",
      description: "List repositories",
      providerName: "github",
    } satisfies CapabilityItem;

    const promptItem = {
      id: "github:triage",
      kind: "prompt",
      name: "triage",
      description: "Triage issue",
      providerName: "github",
    } satisfies CapabilityItem;

    const selectionKey =
      `${toolItem.providerName}:${toolItem.name}` satisfies CapabilitySelectionKey;

    expect(toolItem.kind).toBe("tool");
    expect(promptItem.kind).toBe("prompt");
    expect(selectionKey).toBe("github:list_repos");
  });
});

describe("current tool capabilities adapter", () => {
  it("maps server tools to tool capability items with provider metadata and preserved details", () => {
    const inputSchema = {
      type: "object",
      properties: { path: { type: "string" } },
    } as const;
    const annotations = {
      readOnlyHint: true,
      destructiveHint: false,
    };

    const providers = buildCapabilityProvidersFromCurrentTools({
      targetServers: [
        targetServer({
          name: "filesystem",
          state: { type: "connected" },
          icon: "folder",
          originalTools: [
            {
              name: "read_file",
              description: "Read a file",
              inputSchema,
              annotations,
            },
            {
              name: "missing_description",
              inputSchema: { type: "object" },
            },
          ],
          tools: [
            targetServerTool({
              name: "read_file",
              description: "Read a file",
              inputSchema,
              annotations,
            }),
            targetServerTool({
              name: "missing_description",
              inputSchema: { type: "object" },
            }),
          ],
        }),
      ],
    });

    expect(providers).toEqual([
      {
        name: "filesystem",
        state: { type: "connected" },
        icon: "folder",
        items: [
          {
            id: "filesystem:missing_description",
            kind: "tool",
            name: "missing_description",
            description: "",
            providerName: "filesystem",
            inputSchema: { type: "object" },
            annotations: undefined,
          },
          {
            id: "filesystem:read_file",
            kind: "tool",
            name: "read_file",
            description: "Read a file",
            providerName: "filesystem",
            inputSchema,
            annotations,
          },
        ],
      },
    ]);
  });

  it("maps custom tool extensions before original tools", () => {
    const providers = buildCapabilityProvidersFromCurrentTools({
      targetServers: [
        targetServer({
          name: "filesystem",
          state: { type: "connected" },
          originalTools: [
            {
              name: "read_file",
              description: "Read files",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
              },
              annotations: { readOnlyHint: true },
            },
          ],
          tools: [
            targetServerTool({
              name: "read_file",
              description: "Read files",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
              },
              annotations: { readOnlyHint: true },
            }),
          ],
        }),
      ],
      toolExtensionsServices: {
        filesystem: {
          read_file: {
            childTools: [
              {
                name: "masked_read",
                description: { action: "rewrite", text: "Masked read" },
                overrideParams: {},
              },
            ],
          },
        },
      },
    });

    expect(providers[0]?.items).toEqual([
      {
        id: "filesystem:masked_read",
        kind: "tool",
        name: "masked_read",
        description: "Masked read",
        providerName: "filesystem",
        isCustom: true,
        originalToolName: "read_file",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
        },
        annotations: { readOnlyHint: true },
      },
      {
        id: "filesystem:read_file",
        kind: "tool",
        name: "read_file",
        description: "Read files",
        providerName: "filesystem",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
        },
        annotations: { readOnlyHint: true },
      },
    ]);
  });

  it("uses materialized child tool details without duplicating child tools as originals", () => {
    const providers = buildCapabilityProvidersFromCurrentTools({
      targetServers: [
        targetServer({
          name: "filesystem",
          originalTools: [
            {
              name: "read_file",
              description: "Read files",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
              },
              annotations: { readOnlyHint: true },
            },
          ],
          tools: [
            targetServerTool({
              name: "read_file",
              description: "Read files",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
              },
              annotations: { readOnlyHint: true },
            }),
            targetServerTool({
              name: "masked_read",
              description: "Materialized masked read",
              inputSchema: {
                type: "object",
                properties: { safePath: { type: "string" } },
              },
              annotations: { readOnlyHint: true, destructiveHint: false },
            }),
          ],
        }),
      ],
      toolExtensionsServices: {
        filesystem: {
          read_file: {
            childTools: [
              {
                name: "masked_read",
                description: { action: "rewrite", text: "Config masked read" },
                overrideParams: {},
              },
            ],
          },
        },
      },
    });

    expect(providers[0]?.items).toEqual([
      {
        id: "filesystem:masked_read",
        kind: "tool",
        name: "masked_read",
        description: "Materialized masked read",
        providerName: "filesystem",
        isCustom: true,
        originalToolName: "read_file",
        inputSchema: {
          type: "object",
          properties: { safePath: { type: "string" } },
        },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      {
        id: "filesystem:read_file",
        kind: "tool",
        name: "read_file",
        description: "Read files",
        providerName: "filesystem",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
        },
        annotations: { readOnlyHint: true },
      },
    ]);
  });

  it("does not duplicate custom tools already materialized in original tools", () => {
    const providers = buildCapabilityProvidersFromCurrentTools({
      targetServers: [
        targetServer({
          name: "filesystem",
          originalTools: [
            {
              name: "masked_read",
              description: "Materialized masked read",
              inputSchema: {
                type: "object",
                properties: { safePath: { type: "string" } },
              },
              annotations: { readOnlyHint: true, destructiveHint: false },
            },
            {
              name: "read_file",
              description: "Read files",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
              },
              annotations: { readOnlyHint: true },
            },
          ],
          tools: [
            targetServerTool({
              name: "read_file",
              description: "Read files",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
              },
              annotations: { readOnlyHint: true },
            }),
          ],
        }),
      ],
      toolExtensionsServices: {
        filesystem: {
          read_file: {
            childTools: [
              {
                name: "masked_read",
                description: { action: "rewrite", text: "Config masked read" },
                overrideParams: {},
              },
            ],
          },
        },
      },
    });

    expect(providers[0]?.items.map((item) => item.name)).toEqual([
      "masked_read",
      "read_file",
    ]);
  });

  it("maps tool groups to provider summaries with preserved services and selection keys", () => {
    const groups = buildCapabilityGroupsFromCurrentToolGroups({
      toolGroups: [
        {
          name: "Read Only",
          description: "Safe file operations",
          services: {
            filesystem: ["read_file", "list_files"],
            github: ["list_repos"],
          },
        },
      ],
    });

    expect(groups).toEqual([
      {
        id: "tool_group_0",
        name: "Read Only",
        description: "Safe file operations",
        services: {
          filesystem: ["read_file", "list_files"],
          github: ["list_repos"],
        },
        providers: [
          {
            providerName: "filesystem",
            itemCount: 2,
            itemNames: ["read_file", "list_files"],
            selectionKeys: ["filesystem:read_file", "filesystem:list_files"],
          },
          {
            providerName: "github",
            itemCount: 1,
            itemNames: ["list_repos"],
            selectionKeys: ["github:list_repos"],
          },
        ],
      },
    ]);
  });

  it("maps wildcard tool groups as wildcard summaries distinct from empty groups", () => {
    const groups = buildCapabilityGroupsFromCurrentToolGroups({
      toolGroups: [
        {
          name: "All Filesystem",
          services: {
            filesystem: "*",
            github: [],
          },
        },
      ],
    });

    expect(groups[0]?.providers).toEqual([
      {
        providerName: "filesystem",
        itemCount: 0,
        itemNames: [],
        selectionKeys: [],
        isWildcard: true,
      },
      {
        providerName: "github",
        itemCount: 0,
        itemNames: [],
        selectionKeys: [],
      },
    ]);
  });

  it("sorts providers and items stably with custom items first", () => {
    const providers = buildCapabilityProvidersFromCurrentTools({
      targetServers: [
        targetServer({
          name: "zeta",
          state: { type: "connected" },
          originalTools: [
            { name: "gamma", inputSchema: { type: "object" } },
            { name: "alpha", inputSchema: { type: "object" } },
          ],
          tools: [
            targetServerTool({
              name: "gamma",
              inputSchema: { type: "object" },
            }),
            targetServerTool({
              name: "alpha",
              inputSchema: { type: "object" },
            }),
          ],
        }),
        targetServer({
          name: "alpha",
          state: { type: "connected" },
          originalTools: [{ name: "omega", inputSchema: { type: "object" } }],
          tools: [
            targetServerTool({
              name: "omega",
              inputSchema: { type: "object" },
            }),
          ],
        }),
      ],
      toolExtensionsServices: {
        zeta: {
          gamma: {
            childTools: [
              {
                name: "beta_custom",
                overrideParams: {},
              },
              {
                name: "alpha_custom",
                overrideParams: {},
              },
            ],
          },
        },
      },
    });

    expect(providers.map((provider) => provider.name)).toEqual([
      "alpha",
      "zeta",
    ]);
    expect(providers[1]?.items.map((item) => item.name)).toEqual([
      "alpha_custom",
      "beta_custom",
      "alpha",
      "gamma",
    ]);
  });

  it("returns empty arrays when current backend data is missing", () => {
    expect(buildCapabilityProvidersFromCurrentTools({})).toEqual([]);
    expect(
      buildCapabilityProvidersFromCurrentTools({ targetServers: [] }),
    ).toEqual([]);
    expect(buildCapabilityGroupsFromCurrentToolGroups({})).toEqual([]);
    expect(
      buildCapabilityGroupsFromCurrentToolGroups({ toolGroups: [] }),
    ).toEqual([]);
  });
});
