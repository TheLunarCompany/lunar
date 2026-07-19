import type { EnabledSkills, Skill, SystemState } from "@mcpx/shared-model";
import type { CatalogMCPServerConfigByNameList } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { describe, expect, it } from "vitest";

import type { Agent } from "../types/agent";

import { buildAgentDrawerSkills } from "./agent-drawer";

const SKILL_ID = "11111111-1111-4111-8111-111111111111";

describe("buildAgentDrawerSkills", () => {
  it("maps assigned skills into drawer links with provider availability", () => {
    const result = buildAgentDrawerSkills({
      agent: consumerTagAgent("engineering"),
      enabled: [enabledRow("engineering", [SKILL_ID])],
      skills: [
        {
          ...skill(SKILL_ID),
          capabilityGroup: {
            items: [
              { catalogItemId: "cat-github", tools: ["issues"], prompts: [] },
              { catalogItemId: "cat-coda", tools: ["pages"], prompts: [] },
            ],
          },
        },
      ],
      systemState: systemStateWithTargetServers([
        targetServer("GitHub", "cat-github"),
      ]),
      catalogItems: [catalogItem("cat-coda", "Coda", "Coda")],
      targetServerAttributes: { github: { inactive: true } },
      skillHref: (id) => `/skills/${id}`,
    });

    expect(result).toEqual([
      {
        id: SKILL_ID,
        name: "Review Pull Requests",
        description: "Review repository changes.",
        href: `/skills/${SKILL_ID}`,
        providers: [
          { name: "GitHub", isMissingOrInactive: true },
          { name: "Coda", isMissingOrInactive: true },
        ],
      },
    ]);
  });

  it("returns no view models for anonymous agents or stale assignments", () => {
    const enabled: EnabledSkills[] = [
      enabledRow("engineering", [SKILL_ID, "stale-skill-id"]),
    ];

    expect(
      buildAgentDrawerSkills({
        agent: anonymousAgent(),
        enabled,
        skills: [skill(SKILL_ID)],
        systemState: systemStateWithTargetServers([]),
        skillHref: (id) => `/skills/${id}`,
      }),
    ).toEqual([]);
  });
});

function enabledRow(value: string, skillIds: string[]): EnabledSkills {
  return { subject: { kind: "consumerTag", value }, skillIds };
}

function skill(id: string): Skill {
  return {
    id,
    name: "Review Pull Requests",
    description: "Review repository changes.",
    body: "# Review Pull Requests",
    exposeAsPrompt: true,
    author: { setupOwnerId: "owner-1", displayName: "Owner" },
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
  };
}

function consumerTagAgent(consumerTag: string): Agent {
  return {
    id: "agent-1",
    identifier: consumerTag,
    sessionIds: ["session-1"],
    status: "CONNECTED",
    usage: { callCount: 0 },
    dynamicMode: false,
    visibleTools: [],
    connectionState: "connected",
    identityType: "consumerTag",
    consumerTag,
    clientNames: [],
  };
}

function anonymousAgent(): Agent {
  return {
    id: "agent-1",
    identifier: "anonymous",
    sessionIds: ["session-1"],
    status: "CONNECTED",
    usage: { callCount: 0 },
    dynamicMode: false,
    visibleTools: [],
    connectionState: "connected",
    identityType: "anonymous",
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
  catalogItemId: string,
): SystemState["targetServers"][number] {
  return {
    _type: "stdio",
    name,
    catalogItemId,
    command: "npx",
    state: { type: "connected" },
    tools: [],
    originalTools: [],
    prompts: [],
    originalPrompts: [],
    usage: { callCount: 0 },
  };
}

function catalogItem(
  id: string,
  name: string,
  displayName: string,
): CatalogMCPServerConfigByNameList[number] {
  return {
    id,
    name,
    displayName,
    description: undefined,
    config: { [name]: { type: "stdio", command: "npx", args: [] } },
  };
}
