import { describe, expect, it } from "vitest";

import type { SystemState } from "@mcpx/shared-model";
import { buildConnectedClientMock } from "@mcpx/shared-model/mocks";

import {
  mapTargetServerToMcpServer,
  transformConfigurationData,
} from "./system-state";

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

// One consumerTag cluster over the given sessions.
function systemStateWithClients(
  connectedClients: SystemState["connectedClients"],
  sessionIds: string[],
): SystemState {
  return {
    targetServers: [],
    connectedClients,
    connectedClientClusters: [
      {
        identityType: "consumerTag",
        consumerTag: "team-platform",
        clientNames: ["claude-code"],
        sessionIds,
        usage: { callCount: 0 },
      },
    ],
    usage: { callCount: 0, lastCalledAt: undefined },
    lastUpdatedAt: new Date("2026-05-12T10:00:00Z"),
  };
}

describe("transformConfigurationData live-state mapping", () => {
  it("derives live fields from the healthiest (connected) session", () => {
    const state = systemStateWithClients(
      [
        buildConnectedClientMock({
          sessionId: "s1",
          dynamicMode: true,
          visibleTools: [{ serverName: "jira", toolName: "create_ticket" }],
          connectionState: "connected",
        }),
        buildConnectedClientMock({
          sessionId: "s2",
          connectionState: "unresponsive",
        }),
      ],
      ["s1", "s2"],
    );

    const [agent] = transformConfigurationData(state).agents;

    expect(agent.connectionState).toBe("connected");
    expect(agent.dynamicMode).toBe(true);
    expect(agent.visibleTools).toEqual([
      { serverName: "jira", toolName: "create_ticket" },
    ]);
  });

  it("stays connected when a new live session joins a disconnected one", () => {
    // Old disconnected session + a new live one after hibernation.
    const state = systemStateWithClients(
      [
        buildConnectedClientMock({
          sessionId: "old",
          connectionState: "disconnected",
          disconnectedAt: 1,
        }),
        buildConnectedClientMock({
          sessionId: "new",
          connectionState: "connected",
        }),
      ],
      ["old", "new"],
    );

    const [agent] = transformConfigurationData(state).agents;

    expect(agent.connectionState).toBe("connected");
  });

  it("is disconnected only when every session is disconnected", () => {
    const state = systemStateWithClients(
      [
        buildConnectedClientMock({
          sessionId: "d1",
          connectionState: "disconnected",
          disconnectedAt: 1,
        }),
        buildConnectedClientMock({
          sessionId: "d2",
          connectionState: "disconnected",
          disconnectedAt: 2,
        }),
      ],
      ["d1", "d2"],
    );

    const [agent] = transformConfigurationData(state).agents;

    expect(agent.connectionState).toBe("disconnected");
  });

  it("falls back to connected defaults when the sessions have no client data", () => {
    const state = systemStateWithClients([], ["s-missing"]);

    const [agent] = transformConfigurationData(state).agents;

    expect(agent.dynamicMode).toBe(false);
    expect(agent.visibleTools).toEqual([]);
    expect(agent.connectionState).toBe("connected");
  });
});
