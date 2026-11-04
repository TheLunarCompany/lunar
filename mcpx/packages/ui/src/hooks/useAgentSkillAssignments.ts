import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatePath } from "react-router-dom";

import { useAgentDrawerSkillsData } from "@/data/agent-drawer-skills";
import { useUpdateSkillEnablement } from "@/data/skills";
import { buildAgentDrawerSkills } from "@/mapping/agent-drawer";
import {
  buildAgentSkillEnablementUpdate,
  getEnabledSkillIdsForAgent,
} from "@/mapping/skill-agents";
import { routes } from "@/routes";
import type { Agent } from "@/types";
import type { SystemState } from "@mcpx/shared-model";

export function useAgentSkillAssignments({
  agent,
  enabled,
  systemState,
  targetServerAttributes,
}: {
  agent: Agent | null;
  enabled: boolean;
  systemState: SystemState | null | undefined;
  targetServerAttributes?: Record<string, { inactive?: boolean }>;
}) {
  const data = useAgentDrawerSkillsData({ enabled });
  const updateSkillEnablement = useUpdateSkillEnablement();
  const [draftSkillIds, setDraftSkillIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const initializedAgentIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);

  const baselineSkillIds = useMemo(
    () =>
      agent
        ? getEnabledSkillIdsForAgent({
            agent,
            enabled: data.enabledSkills,
          })
        : new Set<string>(),
    [agent, data.enabledSkills],
  );

  const skills = useMemo(
    () =>
      agent
        ? buildAgentDrawerSkills({
            agent,
            enabled: data.enabledSkills,
            skills: data.skills,
            systemState,
            catalogItems: data.catalogItems,
            targetServerAttributes,
            skillHref: (id) => generatePath(routes.skillDetail, { id }),
            includeUnassigned: true,
          })
        : [],
    [
      agent,
      data.catalogItems,
      data.enabledSkills,
      data.skills,
      systemState,
      targetServerAttributes,
    ],
  );

  useEffect(() => {
    if (!enabled) {
      setInitialized(false);
      setDraftSkillIds((current) => (current.size === 0 ? current : new Set()));
      initializedAgentIdRef.current = null;
      dirtyRef.current = false;
      return;
    }
    if (data.isLoading || data.isError || !agent) return;

    const agentChanged = initializedAgentIdRef.current !== agent.id;
    if (!agentChanged) {
      const draftMatchesBaseline = skillIdSetsEqual(
        draftSkillIds,
        baselineSkillIds,
      );
      if (dirtyRef.current && !draftMatchesBaseline) return;
      if (draftMatchesBaseline) {
        dirtyRef.current = false;
        return;
      }
    }

    setDraftSkillIds(new Set(baselineSkillIds));
    setInitialized(true);
    initializedAgentIdRef.current = agent.id;
    dirtyRef.current = false;
  }, [
    agent,
    baselineSkillIds,
    data.isError,
    data.isLoading,
    draftSkillIds,
    enabled,
  ]);

  const toggleSkill = useCallback(
    (skillId: string, selected: boolean) => {
      setDraftSkillIds((current) => {
        const next = new Set(current);
        if (selected) {
          next.add(skillId);
        } else {
          next.delete(skillId);
        }
        dirtyRef.current = !skillIdSetsEqual(baselineSkillIds, next);
        return next;
      });
    },
    [baselineSkillIds],
  );

  const save = useCallback(async () => {
    if (!agent) return;

    const allSkillIds = new Set([...baselineSkillIds, ...draftSkillIds]);
    const updates = [...allSkillIds].flatMap((skillId) => {
      if (baselineSkillIds.has(skillId) === draftSkillIds.has(skillId)) {
        return [];
      }

      const update = buildAgentSkillEnablementUpdate({
        agent,
        enabled: data.enabledSkills,
        skillId,
        selected: draftSkillIds.has(skillId),
      });
      return update ? [update] : [];
    });

    await Promise.all(
      updates.map((update) => updateSkillEnablement.mutateAsync(update)),
    );
  }, [
    agent,
    baselineSkillIds,
    data.enabledSkills,
    draftSkillIds,
    updateSkillEnablement,
  ]);

  return {
    skills,
    selectedSkillIds: initialized ? draftSkillIds : baselineSkillIds,
    isDirty: initialized && !skillIdSetsEqual(baselineSkillIds, draftSkillIds),
    isLoading: data.isLoading,
    isError: data.isError,
    isSaving: updateSkillEnablement.isPending,
    isInitialized: initialized,
    toggleSkill,
    save,
  };
}

function skillIdSetsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  return a.size === b.size && [...a].every((skillId) => b.has(skillId));
}
