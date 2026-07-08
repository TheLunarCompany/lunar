import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api";
import {
  skillsQueryKey,
  useCreateSkill,
  useDeleteSkill,
  useSkill,
  useSkills,
  useUpdateSkill,
} from "./skills";

vi.mock("@/lib/api", () => ({
  apiClient: {
    getSkills: vi.fn(),
    getSkill: vi.fn(),
    createSkill: vi.fn(),
    updateSkill: vi.fn(),
    deleteSkill: vi.fn(),
  },
}));

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

  it("invalidates skills and detail after update succeeds", async () => {
    vi.mocked(apiClient.updateSkill).mockResolvedValue(skill);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateSkill(), { wrapper });

    await result.current.mutateAsync({
      id: skill.id,
      draft: {
        name: "review-pull-requests",
        description: "Review repository changes with the local project rules.",
        body: "# Review pull requests",
        exposeAsPrompt: true,
      },
    });

    expect(apiClient.updateSkill).toHaveBeenCalledWith(skill.id, {
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
