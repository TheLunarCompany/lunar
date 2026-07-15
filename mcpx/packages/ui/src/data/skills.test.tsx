import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "@/lib/api";
import type { ScopeSubject } from "@mcpx/shared-model";
import {
  skillsQueryKey,
  useCreateSkill,
  useDeleteSkill,
  useEnabledSkills,
  useSkill,
  useSkills,
  useUpdateSkillEnablement,
  useUpdateSkillDetails,
  useUpdateSkillCapabilities,
} from "./skills";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    apiClient: {
      getSkills: vi.fn(),
      getSkill: vi.fn(),
      createSkill: vi.fn(),
      updateSkillDetails: vi.fn(),
      updateSkillCapabilities: vi.fn(),
      deleteSkill: vi.fn(),
      getEnabledSkills: vi.fn(),
      enableSkill: vi.fn(),
      disableSkill: vi.fn(),
    },
  };
});

const skill = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "review-pull-requests",
  description: "Review repository changes with the local project rules.",
  body: "# Review pull requests",
  exposeAsPrompt: true,
  author: {
    setupOwnerId: "owner-1",
    displayName: "Amir",
  },
  updatedAt: new Date("2026-06-29T10:00:00.000Z"),
};

describe("skills data hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("loads personal skills", async () => {
    vi.mocked(apiClient.getSkills).mockResolvedValue([skill]);

    const { result } = renderHook(() => useSkills(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.getSkills).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual([skill]);
  });

  it("loads one skill by id", async () => {
    vi.mocked(apiClient.getSkill).mockResolvedValue(skill);

    const { result } = renderHook(() => useSkill(skill.id), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.getSkill).toHaveBeenCalledWith(skill.id);
    expect(result.current.data).toEqual(skill);
  });

  it("loads enabled skills", async () => {
    const enabled = [
      {
        subject: { kind: "consumerTag" as const, value: "reviewers" },
        skillIds: [skill.id],
      },
    ];
    vi.mocked(apiClient.getEnabledSkills).mockResolvedValue(enabled);

    const { result } = renderHook(() => useEnabledSkills(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.getEnabledSkills).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual(enabled);
  });

  it("does not fetch skill data when the query is disabled", () => {
    const skillsQuery = renderHook(() => useSkills({ enabled: false }), {
      wrapper,
    });
    const enabledQuery = renderHook(
      () => useEnabledSkills({ enabled: false }),
      { wrapper },
    );

    expect(skillsQuery.result.current.fetchStatus).toBe("idle");
    expect(enabledQuery.result.current.fetchStatus).toBe("idle");
    expect(apiClient.getSkills).not.toHaveBeenCalled();
    expect(apiClient.getEnabledSkills).not.toHaveBeenCalled();
  });

  it("does not write when skill enablement is unchanged", async () => {
    const reviewers: ScopeSubject = {
      kind: "consumerTag",
      value: "reviewers",
    };
    const { result } = renderHook(() => useUpdateSkillEnablement(), {
      wrapper,
    });

    await result.current.mutateAsync({
      skillId: skill.id,
      previous: [reviewers],
      next: [reviewers],
    });

    expect(apiClient.enableSkill).not.toHaveBeenCalled();
    expect(apiClient.disableSkill).not.toHaveBeenCalled();
  });

  it("enables only added subjects", async () => {
    const reviewers: ScopeSubject = {
      kind: "consumerTag",
      value: "reviewers",
    };
    vi.mocked(apiClient.enableSkill).mockResolvedValue(undefined);
    const { result } = renderHook(() => useUpdateSkillEnablement(), {
      wrapper,
    });

    await result.current.mutateAsync({
      skillId: skill.id,
      previous: [],
      next: [reviewers],
    });

    expect(apiClient.enableSkill).toHaveBeenCalledWith(skill.id, reviewers);
    expect(apiClient.disableSkill).not.toHaveBeenCalled();
  });

  it("disables only removed subjects", async () => {
    const reviewers: ScopeSubject = {
      kind: "consumerTag",
      value: "reviewers",
    };
    vi.mocked(apiClient.disableSkill).mockResolvedValue(undefined);
    const { result } = renderHook(() => useUpdateSkillEnablement(), {
      wrapper,
    });

    await result.current.mutateAsync({
      skillId: skill.id,
      previous: [reviewers],
      next: [],
    });

    expect(apiClient.disableSkill).toHaveBeenCalledWith(skill.id, reviewers);
    expect(apiClient.enableSkill).not.toHaveBeenCalled();
  });

  it("applies added and removed subjects together", async () => {
    const previous: ScopeSubject = {
      kind: "consumerTag",
      value: "old-reviewers",
    };
    const next: ScopeSubject = { kind: "clientName", value: "new-agent" };
    vi.mocked(apiClient.enableSkill).mockResolvedValue(undefined);
    vi.mocked(apiClient.disableSkill).mockResolvedValue(undefined);
    const { result } = renderHook(() => useUpdateSkillEnablement(), {
      wrapper,
    });

    await result.current.mutateAsync({
      skillId: skill.id,
      previous: [previous],
      next: [next],
    });

    expect(apiClient.enableSkill).toHaveBeenCalledWith(skill.id, next);
    expect(apiClient.disableSkill).toHaveBeenCalledWith(skill.id, previous);
  });

  it("awaits enabled-skill invalidation after a successful update", async () => {
    vi.mocked(apiClient.enableSkill).mockResolvedValue(undefined);
    const invalidation = deferred<void>();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockReturnValue(invalidation.promise);
    const { result } = renderHook(() => useUpdateSkillEnablement(), {
      wrapper,
    });
    let settled = false;

    const mutation = result.current
      .mutateAsync({
        skillId: skill.id,
        previous: [],
        next: [{ kind: "clientName", value: "review-agent" }],
      })
      .then(() => {
        settled = true;
      });

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledOnce());
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: skillsQueryKey.enabled,
    });
    expect(settled).toBe(false);

    invalidation.resolve();
    await mutation;
    expect(settled).toBe(true);
  });

  it("preserves one ApiError after every write settles and invalidates", async () => {
    const enablement = deferred<void>();
    const disablement = deferred<void>();
    const invalidation = deferred<void>();
    const enableError = new ApiError("Skill enablement denied", 403, {
      message: "Skill enablement denied",
    });
    vi.mocked(apiClient.enableSkill).mockReturnValue(enablement.promise);
    vi.mocked(apiClient.disableSkill).mockReturnValue(disablement.promise);
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockReturnValue(invalidation.promise);
    const { result } = renderHook(() => useUpdateSkillEnablement(), {
      wrapper,
    });

    let settled = false;
    const mutation = result.current.mutateAsync({
      skillId: skill.id,
      previous: [{ kind: "consumerTag", value: "old-reviewers" }],
      next: [{ kind: "clientName", value: "new-agent" }],
    });
    void mutation.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await waitFor(() => {
      expect(apiClient.enableSkill).toHaveBeenCalledOnce();
      expect(apiClient.disableSkill).toHaveBeenCalledOnce();
    });
    enablement.reject(enableError);
    await Promise.resolve();
    expect(invalidateQueries).not.toHaveBeenCalled();

    disablement.resolve();
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledOnce());
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: skillsQueryKey.enabled,
    });
    expect(settled).toBe(false);

    invalidation.resolve();
    await expect(mutation).rejects.toBe(enableError);
  });

  it("aggregates multiple normalized failures after every write settles", async () => {
    const enablement = deferred<void>();
    const disablement = deferred<void>();
    const enableError = new ApiError("Skill enablement denied", 403, {
      message: "Skill enablement denied",
    });
    vi.mocked(apiClient.enableSkill).mockReturnValue(enablement.promise);
    vi.mocked(apiClient.disableSkill).mockReturnValue(disablement.promise);
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const { result } = renderHook(() => useUpdateSkillEnablement(), {
      wrapper,
    });
    let settled = false;

    const mutation = result.current.mutateAsync({
      skillId: skill.id,
      previous: [{ kind: "consumerTag", value: "old-reviewers" }],
      next: [{ kind: "clientName", value: "new-agent" }],
    });
    const rejection = mutation.catch((reason: unknown) => {
      settled = true;
      return reason;
    });

    enablement.reject(enableError);
    await Promise.resolve();
    expect(settled).toBe(false);

    disablement.reject("disable failed");
    const error = await rejection;

    expect(error).toBeInstanceOf(AggregateError);
    expect(error).toMatchObject({
      message: "Failed to update skill enablement",
      errors: [enableError, expect.any(Error)],
    });
    expect((error as AggregateError).errors[1]).toMatchObject({
      message: "disable failed",
    });
  });

  it("invalidates skills after create succeeds", async () => {
    vi.mocked(apiClient.createSkill).mockResolvedValue(skill);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateSkill(), { wrapper });

    await result.current.mutateAsync({
      name: "review-pull-requests",
      description: "Review repository changes with the local project rules.",
      body: "# Review pull requests",
      exposeAsPrompt: true,
    });

    expect(apiClient.createSkill).toHaveBeenCalledOnce();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: skillsQueryKey.all,
    });
  });

  it("invalidates skills and detail after details update succeeds", async () => {
    vi.mocked(apiClient.updateSkillDetails).mockResolvedValue(skill);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateSkillDetails(), { wrapper });

    await result.current.mutateAsync({
      id: skill.id,
      draft: {
        name: "review-pull-requests",
        description: "Review repository changes with the local project rules.",
        body: "# Review pull requests",
        exposeAsPrompt: true,
      },
    });

    expect(apiClient.updateSkillDetails).toHaveBeenCalledWith(skill.id, {
      name: "review-pull-requests",
      description: "Review repository changes with the local project rules.",
      body: "# Review pull requests",
      exposeAsPrompt: true,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: skillsQueryKey.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: skillsQueryKey.detail(skill.id),
    });
  });

  it("invalidates skills and detail after capabilities update succeeds", async () => {
    vi.mocked(apiClient.updateSkillCapabilities).mockResolvedValue(skill);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateSkillCapabilities(), {
      wrapper,
    });

    await result.current.mutateAsync({
      id: skill.id,
      capabilityGroup: {
        items: [
          {
            catalogItemId: "0190a000-0000-7000-8000-000000000010",
            tools: ["get_pull_request"],
            prompts: ["review_diff"],
          },
        ],
      },
    });

    expect(apiClient.updateSkillCapabilities).toHaveBeenCalledWith(skill.id, {
      items: [
        {
          catalogItemId: "0190a000-0000-7000-8000-000000000010",
          tools: ["get_pull_request"],
          prompts: ["review_diff"],
        },
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: skillsQueryKey.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: skillsQueryKey.detail(skill.id),
    });
  });

  it("invalidates skills after delete succeeds", async () => {
    vi.mocked(apiClient.deleteSkill).mockResolvedValue(undefined);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeleteSkill(), { wrapper });

    await result.current.mutateAsync(skill.id);

    expect(apiClient.deleteSkill).toHaveBeenCalledWith(skill.id);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: skillsQueryKey.all,
    });
  });

  function wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
