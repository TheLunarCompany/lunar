import type { EnabledSkills, Skill } from "@mcpx/shared-model";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetMCPServers } from "./catalog-servers";
import { useEnabledSkills, useSkills } from "./skills";
import { useAgentDrawerSkillsData } from "./agent-drawer-skills";

vi.mock("./catalog-servers", () => ({
  useGetMCPServers: vi.fn(),
}));

vi.mock("./skills", () => ({
  useSkills: vi.fn(),
  useEnabledSkills: vi.fn(),
}));

describe("useAgentDrawerSkillsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the feature flag to all skill-related queries and exposes their data", () => {
    const skill = { id: "skill-1" } as Skill;
    const enabled = [] as EnabledSkills[];
    vi.mocked(useSkills).mockReturnValue(queryResult([skill]));
    vi.mocked(useEnabledSkills).mockReturnValue(queryResult(enabled));
    vi.mocked(useGetMCPServers).mockReturnValue(queryResult([]));

    const { result } = renderHook(() =>
      useAgentDrawerSkillsData({ enabled: false }),
    );

    expect(useSkills).toHaveBeenCalledWith({ enabled: false });
    expect(useEnabledSkills).toHaveBeenCalledWith({ enabled: false });
    expect(useGetMCPServers).toHaveBeenCalledWith({ enabled: false });
    expect(result.current).toEqual({
      skills: [skill],
      enabledSkills: enabled,
      catalogItems: [],
      isLoading: false,
      isError: false,
    });
  });

  it("only reports skill loading and errors for the Skills section state", () => {
    vi.mocked(useSkills).mockReturnValue(
      queryResult<Skill>([], { isLoading: true }),
    );
    vi.mocked(useEnabledSkills).mockReturnValue(queryResult([]));
    vi.mocked(useGetMCPServers).mockReturnValue(
      queryResult([], { isLoading: true, isError: true }),
    );

    const { result } = renderHook(() =>
      useAgentDrawerSkillsData({ enabled: true }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
  });
});

function queryResult<T>(
  data: T,
  state: { isLoading?: boolean; isError?: boolean } = {},
) {
  return {
    data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  } as never;
}
