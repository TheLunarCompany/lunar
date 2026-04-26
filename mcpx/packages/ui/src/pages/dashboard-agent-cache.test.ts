import { describe, expect, it } from "vitest";
import type { Agent } from "@/types";
import { haveDashboardAgentsChanged } from "./dashboard-agent-cache";

function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-cluster-0",
    identifier: "cursor-vscode",
    sessionIds: ["session-1"],
    status: "connected",
    lastActivity: "2026-04-23T10:00:00.000Z",
    llm: {
      provider: "openai",
      model: "gpt-5.4",
    },
    usage: {
      callCount: 1,
      lastCalledAt: "2026-04-23T10:00:00.000Z",
    },
    ...overrides,
  };
}

describe("haveDashboardAgentsChanged", () => {
  it("detects session id changes for an existing cluster", () => {
    const previousAgents = [createAgent({ sessionIds: ["session-1"] })];
    const nextAgents = [
      createAgent({ sessionIds: ["session-1", "session-2"] }),
    ];

    expect(haveDashboardAgentsChanged(previousAgents, nextAgents)).toBe(true);
  });

  it("detects activity changes for an existing cluster", () => {
    const previousAgents = [
      createAgent({ lastActivity: "2026-04-23T10:00:00.000Z" }),
    ];
    const nextAgents = [
      createAgent({ lastActivity: "2026-04-23T10:05:00.000Z" }),
    ];

    expect(haveDashboardAgentsChanged(previousAgents, nextAgents)).toBe(true);
  });

  it("does not report changes for identical agent snapshots", () => {
    const previousAgents = [createAgent()];
    const nextAgents = [createAgent()];

    expect(haveDashboardAgentsChanged(previousAgents, nextAgents)).toBe(false);
  });
});
