import { apiClient } from "@/lib/api";
import { diffScopeSubjects } from "@/mapping/skill-agents";
import type {
  ScopeSubject,
  SkillCapabilityGroup,
  SkillDraft,
} from "@mcpx/shared-model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SkillDetailsDraft = Omit<SkillDraft, "capabilityGroup">;

export const skillsQueryKey = {
  all: ["skills"] as const,
  detail: (id: string) => ["skills", id] as const,
  enabled: ["skills", "enabled"] as const,
};

export function useSkills() {
  return useQuery({
    queryKey: skillsQueryKey.all,
    queryFn: () => apiClient.getSkills(),
  });
}

export function useSkill(id: string) {
  return useQuery({
    queryKey: skillsQueryKey.detail(id),
    queryFn: () => apiClient.getSkill(id),
    enabled: id.length > 0,
  });
}

export function useEnabledSkills() {
  return useQuery({
    queryKey: skillsQueryKey.enabled,
    queryFn: () => apiClient.getEnabledSkills(),
  });
}

export function useUpdateSkillEnablement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      skillId,
      previous,
      next,
    }: {
      skillId: string;
      previous: ScopeSubject[];
      next: ScopeSubject[];
    }) => {
      const { added, removed } = diffScopeSubjects({ previous, next });
      const results = await Promise.allSettled([
        ...added.map((subject) => apiClient.enableSkill(skillId, subject)),
        ...removed.map((subject) => apiClient.disableSkill(skillId, subject)),
      ]);

      const errors = results.flatMap((result) =>
        result.status === "rejected"
          ? [
              result.reason instanceof Error
                ? result.reason
                : new Error(String(result.reason)),
            ]
          : [],
      );

      if (errors.length === 1) {
        throw errors[0];
      }
      if (errors.length > 1) {
        throw new AggregateError(errors, "Failed to update skill enablement");
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: skillsQueryKey.enabled }),
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: SkillDraft) => apiClient.createSkill(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsQueryKey.all });
    },
  });
}

export function useUpdateSkillDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: SkillDetailsDraft }) =>
      apiClient.updateSkillDetails(id, draft),
    onSuccess: (_skill, { id }) => {
      queryClient.invalidateQueries({ queryKey: skillsQueryKey.all });
      queryClient.invalidateQueries({ queryKey: skillsQueryKey.detail(id) });
    },
  });
}

export function useUpdateSkillCapabilities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      capabilityGroup,
    }: {
      id: string;
      capabilityGroup: SkillCapabilityGroup | null | undefined;
    }) => apiClient.updateSkillCapabilities(id, capabilityGroup),
    onSuccess: (_skill, { id }) => {
      queryClient.invalidateQueries({ queryKey: skillsQueryKey.all });
      queryClient.invalidateQueries({ queryKey: skillsQueryKey.detail(id) });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteSkill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsQueryKey.all });
    },
  });
}
