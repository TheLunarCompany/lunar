import { describe, expect, it } from "vitest";

import type { SystemState } from "@mcpx/shared-model";

import { mapTargetServerToMcpServer } from "./system-state";

function createSystemState(
  targetServers: SystemState["targetServers"],
): SystemState {
  return {
    connectedClientClusters: [],
    connectedClients: [],
    lastUpdatedAt: new Date("2026-05-12T10:00:00Z"),
    targetServers,
    usage: {
      callCount: 0,
      lastCalledAt: undefined,
    },
  };
}

describe("system-state mapping", () => {
  it("maps a live target server to the dashboard modal server shape", () => {
    const lastCalledAt = new Date();
    const systemState = createSystemState([
      {
        _type: "stdio",
        args: ["-y", "@modelcontextprotocol/server-github"],
        catalogItemId: "github",
        command: "npx",
        env: { GITHUB_TOKEN: { fromSecret: "github-token" } },
        icon: "#111827",
        name: "github",
        originalTools: [],
        state: { type: "connected" },
        tools: [
          {
            inputSchema: { type: "object" },
            name: "search_repositories",
            usage: { callCount: 4 },
          },
          {
            description: "Create an issue",
            inputSchema: { type: "object" },
            name: "create_issue",
            usage: {
              callCount: 2,
              lastCalledAt,
            },
          },
        ],
        prompts: [
          {
            name: "issue_template",
            description: "Draft a GitHub issue",
            usage: {
              callCount: 3,
              lastCalledAt,
            },
          },
        ],
        usage: {
          callCount: 6,
          lastCalledAt,
        },
      },
    ]);

    const server = mapTargetServerToMcpServer(systemState.targetServers[0]);

    expect(server).toMatchObject({
      args: ["-y", "@modelcontextprotocol/server-github"],
      catalogItemId: "github",
      command: "npx",
      env: { GITHUB_TOKEN: { fromSecret: "github-token" } },
      icon: "#111827",
      id: "server-github",
      name: "github",
      status: "connected_running",
      tools: [
        {
          description: "",
          invocations: 4,
          lastCalledAt: undefined,
          name: "search_repositories",
        },
        {
          description: "Create an issue",
          invocations: 2,
          lastCalledAt,
          name: "create_issue",
        },
      ],
      prompts: [
        {
          description: "Draft a GitHub issue",
          invocations: 3,
          lastCalledAt,
          name: "issue_template",
        },
      ],
      type: "stdio",
      usage: {
        callCount: 6,
        lastCalledAt,
      },
    });
  });
});
