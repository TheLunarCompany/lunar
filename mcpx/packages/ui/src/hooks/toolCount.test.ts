import type { EnabledSkills, Skill } from "@mcpx/shared-model";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useEnabledSkills,
  useSkills,
  useSkillsFeatureEnabled,
} from "@/data/skills";

import { getSkillToolsForAgent } from "./toolCount";
import { useToolCount } from "./useToolCount";

const SKILL_ONE_ID = "0190a000-0000-7000-8000-000000000001";
const SKILL_TWO_ID = "0190a000-0000-7000-8000-000000000002";

const hookState = vi.hoisted(() => ({
  toolGroups: [
    {
      id: "group-1",
      name: "Legacy group",
      services: { github: ["list_issues"] },
    },
  ],
  appConfig: {
    permissions: {
      consumers: {},
      clientNames: {
        cursor: {
          _type: "default-block" as const,
          allow: ["Legacy group"],
        },
      },
    },
    skills: {
      enabled: [
        {
          subject: { kind: "clientName" as const, value: "cursor" },
          skillIds: ["0190a000-0000-7000-8000-000000000001"],
        },
      ],
    },
    targetServerAttributes: {},
  },
  systemState: {
    connectedClients: [{ sessionId: "session-1" }],
    targetServers: [
      {
        name: "github",
        catalogItemId: "catalog-github",
        tools: [
          { name: "list_issues" },
          { name: "create_issue" },
          { name: "search_issues" },
        ],
      },
    ],
  },
}));

vi.mock("@/data/skills", () => ({
  useSkillsFeatureEnabled: vi.fn(),
  useEnabledSkills: vi.fn(),
  useSkills: vi.fn(),
}));
vi.mock("@/store", () => ({
  useAccessControlsStore: (selector: (value: typeof hookState) => unknown) =>
    selector(hookState),
  useSocketStore: (
    selector: (value: {
      appConfig: typeof hookState.appConfig;
      systemState: typeof hookState.systemState;
    }) => unknown,
  ) => selector(hookState),
}));

const hookSkill: Skill = {
  id: SKILL_ONE_ID,
  name: "Cursor workflow",
  description: "Cursor workflow",
  body: "# Cursor workflow",
  exposeAsPrompt: true,
  author: { setupOwnerId: "owner", displayName: "Owner" },
  updatedAt: new Date("2026-08-03T10:00:00.000Z"),
  publishedAt: null,
  capabilityGroup: {
    items: [
      {
        catalogItemId: "catalog-github",
        tools: ["create_issue", "search_issues"],
        prompts: [],
      },
    ],
  },
};

describe("getSkillToolsForAgent", () => {
  it("counts the union of tools across skills assigned to a consumer", () => {
    const count = getSkillToolsForAgent({
      agent: { sessionIds: ["session-1"], identifier: "cursor" },
      connectedClients: [
        { sessionId: "session-1", consumerTag: "engineering" },
      ],
      skills: [
        skill(SKILL_ONE_ID, ["list_issues", "shared_tool"]),
        skill(SKILL_TWO_ID, ["create_issue", "shared_tool"]),
      ],
      enabled: [
        enabled("consumerTag", "engineering", [SKILL_ONE_ID, SKILL_TWO_ID]),
      ],
      targetServers: [server()],
    });

    expect(count).toBe(3);
  });

  it("resolves wildcard selections from active connected servers", () => {
    const params = {
      agent: { sessionIds: ["session-1"], identifier: "cursor" },
      connectedClients: [{ sessionId: "session-1" }],
      skills: [skill(SKILL_ONE_ID, "*")],
      enabled: [enabled("clientName", "cursor", [SKILL_ONE_ID])],
      targetServers: [server()],
    };

    expect(getSkillToolsForAgent(params)).toBe(3);
    expect(
      getSkillToolsForAgent({
        ...params,
        targetServerAttributes: { github: { inactive: true } },
      }),
    ).toBe(0);
  });

  it("returns all available tools when the agent has no assigned skills", () => {
    expect(
      getSkillToolsForAgent({
        agent: { sessionIds: ["session-1"], identifier: "cursor" },
        connectedClients: [{ sessionId: "session-1" }],
        skills: [skill(SKILL_ONE_ID, ["list_issues"])],
        enabled: [],
        targetServers: [server()],
      }),
    ).toBe(3);
  });
});

describe("useToolCount", () => {
  beforeEach(() => {
    hookState.appConfig.skills.enabled = [
      {
        subject: { kind: "clientName", value: "cursor" },
        skillIds: [SKILL_ONE_ID],
      },
    ];
    vi.mocked(useSkills).mockReturnValue({ data: [hookSkill] } as never);
    vi.mocked(useEnabledSkills).mockReturnValue({
      data: hookState.appConfig.skills.enabled,
    } as never);
    hookState.appConfig.permissions.clientNames.cursor = {
      _type: "default-block",
      allow: ["Legacy group"],
    };
  });

  it("uses assigned skill tools instead of tool groups when Skills is enabled", () => {
    vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: true });

    const { result } = renderHook(() =>
      useToolCount({
        agent: { sessionIds: ["session-1"], identifier: "cursor" },
      }),
    );

    expect(result.current.availableTools).toBe(2);
    expect(useSkills).toHaveBeenCalledWith({ enabled: true });
    expect(useEnabledSkills).toHaveBeenCalledWith({ enabled: true });
  });

  it("keeps tool-group counting when Skills is disabled", () => {
    vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: false });

    const { result } = renderHook(() =>
      useToolCount({
        agent: { sessionIds: ["session-1"], identifier: "cursor" },
      }),
    );

    expect(result.current.availableTools).toBe(1);
    expect(useSkills).toHaveBeenCalledWith({ enabled: false });
    expect(useEnabledSkills).toHaveBeenCalledWith({ enabled: false });
  });

  it("uses assigned skills even when legacy permissions are unrestricted", () => {
    vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: true });
    delete (
      hookState.appConfig.permissions.clientNames as Partial<
        typeof hookState.appConfig.permissions.clientNames
      >
    ).cursor;

    const { result } = renderHook(() =>
      useToolCount({
        agent: { sessionIds: ["session-1"], identifier: "cursor" },
      }),
    );

    expect(result.current.availableTools).toBe(2);
  });

  it("shows all available tools when the agent has no assigned skills", () => {
    vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: true });
    hookState.appConfig.skills.enabled = [];
    vi.mocked(useEnabledSkills).mockReturnValue({ data: [] } as never);

    const { result } = renderHook(() =>
      useToolCount({
        agent: { sessionIds: ["session-1"], identifier: "cursor" },
      }),
    );

    expect(result.current.availableTools).toBe(3);
  });

  it("shows the full connected count while skills are still loading", () => {
    vi.mocked(useSkillsFeatureEnabled).mockReturnValue({ data: true });
    vi.mocked(useSkills).mockReturnValue({ data: undefined } as never);

    const { result } = renderHook(() =>
      useToolCount({
        agent: { sessionIds: ["session-1"], identifier: "cursor" },
      }),
    );

    expect(result.current.availableTools).toBe(3);
  });
});

function skill(id: string, tools: string[] | "*"): Skill {
  return {
    id,
    name: `Skill ${id}`,
    description: "Skill description",
    body: "# Skill",
    exposeAsPrompt: true,
    author: { setupOwnerId: "owner", displayName: "Owner" },
    updatedAt: new Date("2026-08-03T10:00:00.000Z"),
    publishedAt: null,
    capabilityGroup: {
      items: [{ catalogItemId: "catalog-github", tools, prompts: [] }],
    },
  };
}

function enabled(
  kind: "consumerTag" | "clientName",
  value: string,
  skillIds: string[],
): EnabledSkills {
  return { subject: { kind, value }, skillIds };
}

function server() {
  return {
    name: "github",
    catalogItemId: "catalog-github",
    tools: [
      { name: "list_issues" },
      { name: "create_issue" },
      { name: "shared_tool" },
    ],
  };
}
