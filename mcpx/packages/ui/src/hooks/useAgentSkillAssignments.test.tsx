import type { Skill, SystemState } from "@mcpx/shared-model";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentDrawerSkillsData } from "@/data/agent-drawer-skills";
import { useUpdateSkillEnablement } from "@/data/skills";
import type { Agent } from "@/types";

import { useAgentSkillAssignments } from "./useAgentSkillAssignments";

vi.mock("@/data/agent-drawer-skills", () => ({
  useAgentDrawerSkillsData: vi.fn(),
}));

vi.mock("@/data/skills", () => ({
  useUpdateSkillEnablement: vi.fn(),
}));

const ASSIGNED_SKILL_ID = "11111111-1111-4111-8111-111111111111";
const UNASSIGNED_SKILL_ID = "22222222-2222-4222-8222-222222222222";
const subject = { kind: "consumerTag" as const, value: "engineering" };

describe("useAgentSkillAssignments", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    mutateAsync.mockReset().mockResolvedValue(undefined);
    vi.mocked(useUpdateSkillEnablement).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useAgentDrawerSkillsData).mockReturnValue({
      skills: [
        skill(ASSIGNED_SKILL_ID, "Code Review"),
        skill(UNASSIGNED_SKILL_ID, "Incident Debugging"),
      ],
      enabledSkills: [
        {
          subject,
          skillIds: [ASSIGNED_SKILL_ID],
        },
      ],
      catalogItems: [],
      isLoading: false,
      isError: false,
    });
  });

  it("owns assignment draft state and persists only changed skills", async () => {
    const { result } = renderHook(() =>
      useAgentSkillAssignments({
        agent,
        enabled: true,
        systemState,
        targetServerAttributes: {},
      }),
    );

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    expect(result.current.skills.map(({ id }) => id)).toEqual([
      ASSIGNED_SKILL_ID,
      UNASSIGNED_SKILL_ID,
    ]);
    expect(result.current.selectedSkillIds).toEqual(
      new Set([ASSIGNED_SKILL_ID]),
    );
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.toggleSkill(UNASSIGNED_SKILL_ID, true));
    expect(result.current.isDirty).toBe(true);

    await act(() => result.current.save());

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      skillId: UNASSIGNED_SKILL_ID,
      previous: [],
      next: [subject],
    });
  });

  it("does not fetch or initialize assignments when disabled", () => {
    const { result } = renderHook(() =>
      useAgentSkillAssignments({
        agent,
        enabled: false,
        systemState,
      }),
    );

    expect(useAgentDrawerSkillsData).toHaveBeenCalledWith({ enabled: false });
    expect(result.current.isInitialized).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });

  it("preserves unsaved toggles across enablement refetches", async () => {
    const { result, rerender } = renderHook(() =>
      useAgentSkillAssignments({
        agent,
        enabled: true,
        systemState,
      }),
    );

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    act(() => result.current.toggleSkill(UNASSIGNED_SKILL_ID, true));

    vi.mocked(useAgentDrawerSkillsData).mockReturnValue({
      skills: [
        skill(ASSIGNED_SKILL_ID, "Code Review"),
        skill(UNASSIGNED_SKILL_ID, "Incident Debugging"),
      ],
      enabledSkills: [{ subject, skillIds: [ASSIGNED_SKILL_ID] }],
      catalogItems: [],
      isLoading: false,
      isError: false,
    });
    rerender();

    expect(result.current.selectedSkillIds).toEqual(
      new Set([ASSIGNED_SKILL_ID, UNASSIGNED_SKILL_ID]),
    );
    expect(result.current.isDirty).toBe(true);
  });
});

const agent: Agent = {
  id: "agent-1",
  identifier: "engineering",
  sessionIds: ["session-1"],
  status: "CONNECTED",
  usage: { callCount: 0 },
  dynamicMode: false,
  visibleTools: [],
  connectionState: "connected",
  identityType: "consumerTag",
  consumerTag: "engineering",
  clientNames: [],
};

const systemState: SystemState = {
  targetServers: [],
  connectedClients: [],
  connectedClientClusters: [],
  usage: { callCount: 0 },
  lastUpdatedAt: new Date("2026-08-03T00:00:00.000Z"),
};

function skill(id: string, name: string): Skill {
  return {
    id,
    name,
    description: `${name} description`,
    body: `# ${name}`,
    exposeAsPrompt: true,
    author: { setupOwnerId: "owner-1", displayName: "Owner" },
    updatedAt: new Date("2026-08-03T00:00:00.000Z"),
    publishedAt: null,
  };
}
