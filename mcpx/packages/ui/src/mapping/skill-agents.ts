import {
  scopeSubjectKey,
  type EnabledSkills,
  type Skill,
  type ScopeSubject,
  type SystemState,
} from "@mcpx/shared-model";
import type { Agent } from "../types/agent";

export type SkillAgentOption = {
  key: string;
  subject: ScopeSubject;
  label: string;
  connected: boolean;
};

export type SkillEnablementUpdate = {
  skillId: string;
  previous: ScopeSubject[];
  next: ScopeSubject[];
};

export function buildAgentSkills({
  agent,
  enabled,
  skills,
}: {
  agent: Agent;
  enabled: EnabledSkills[];
  skills: Skill[];
}): Skill[] {
  const assignedSkillIds = getEnabledSkillIdsForAgent({ agent, enabled });

  return skills
    .filter((skill) => assignedSkillIds.has(skill.id))
    .sort((a, b) => {
      const nameComparison = compareStrings(
        a.name.toLowerCase(),
        b.name.toLowerCase(),
      );
      return nameComparison !== 0
        ? nameComparison
        : compareStrings(a.name, b.name);
    });
}

export function getEnabledSkillIdsForAgent({
  agent,
  enabled,
}: {
  agent: Agent;
  enabled: EnabledSkills[];
}): Set<string> {
  const subject = getAgentSkillSubject(agent);
  if (!subject) return new Set();

  const subjectKey = scopeSubjectKey(subject);
  return new Set(
    enabled
      .filter((row) => scopeSubjectKey(row.subject) === subjectKey)
      .flatMap((row) => row.skillIds),
  );
}

export function buildAgentSkillEnablementUpdate({
  agent,
  enabled,
  skillId,
  selected,
}: {
  agent: Agent;
  enabled: EnabledSkills[];
  skillId: string;
  selected: boolean;
}): SkillEnablementUpdate | null {
  const subject = getAgentSkillSubject(agent);
  if (!subject) return null;

  const previousByKey = new Map<string, ScopeSubject>();
  for (const row of enabled) {
    if (row.skillIds.includes(skillId)) {
      previousByKey.set(scopeSubjectKey(row.subject), row.subject);
    }
  }

  const previous = [...previousByKey.values()];
  const subjectKey = scopeSubjectKey(subject);
  if (selected) {
    previousByKey.set(subjectKey, subject);
  } else {
    previousByKey.delete(subjectKey);
  }

  return {
    skillId,
    previous,
    next: [...previousByKey.values()],
  };
}

export function buildSkillAgentSelection({
  clusters,
  enabled,
  skillId,
}: {
  clusters: SystemState["connectedClientClusters"];
  enabled: EnabledSkills[];
  skillId: string;
}): { options: SkillAgentOption[]; selected: ScopeSubject[] } {
  const optionsByKey = new Map<string, SkillAgentOption>();

  for (const cluster of clusters) {
    let subject: ScopeSubject;

    switch (cluster.identityType) {
      case "consumerTag":
        subject = { kind: "consumerTag", value: cluster.consumerTag };
        break;
      case "clientName":
        subject = { kind: "clientName", value: cluster.clientName };
        break;
      case "anonymous":
        continue;
    }

    const key = scopeSubjectKey(subject);
    optionsByKey.set(key, {
      key,
      subject,
      label: subject.value,
      connected: true,
    });
  }

  const selectedByKey = new Map<string, ScopeSubject>();

  for (const row of enabled) {
    if (!row.skillIds.includes(skillId)) continue;

    const key = scopeSubjectKey(row.subject);
    selectedByKey.set(key, row.subject);

    if (!optionsByKey.has(key)) {
      optionsByKey.set(key, {
        key,
        subject: row.subject,
        label: row.subject.value,
        connected: false,
      });
    }
  }

  return {
    options: [...optionsByKey.values()].sort(compareOptions),
    selected: [...selectedByKey.values()],
  };
}

export function diffScopeSubjects({
  previous,
  next,
}: {
  previous: ScopeSubject[];
  next: ScopeSubject[];
}): { added: ScopeSubject[]; removed: ScopeSubject[] } {
  const previousByKey = new Map(
    previous.map((subject) => [scopeSubjectKey(subject), subject]),
  );
  const nextByKey = new Map(
    next.map((subject) => [scopeSubjectKey(subject), subject]),
  );

  return {
    added: [...nextByKey]
      .filter(([key]) => !previousByKey.has(key))
      .map(([, subject]) => subject),
    removed: [...previousByKey]
      .filter(([key]) => !nextByKey.has(key))
      .map(([, subject]) => subject),
  };
}

function compareOptions(a: SkillAgentOption, b: SkillAgentOption): number {
  if (a.connected !== b.connected) return a.connected ? -1 : 1;

  const valueComparison = compareStrings(
    a.subject.value.toLowerCase(),
    b.subject.value.toLowerCase(),
  );
  if (valueComparison !== 0) return valueComparison;

  const kindComparison = compareStrings(a.subject.kind, b.subject.kind);
  if (kindComparison !== 0) return kindComparison;

  return compareStrings(a.subject.value, b.subject.value);
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function getAgentSkillSubject(agent: Agent): ScopeSubject | null {
  switch (agent.identityType) {
    case "consumerTag":
      return { kind: "consumerTag", value: agent.consumerTag };
    case "clientName":
      return { kind: "clientName", value: agent.clientName };
    case "anonymous":
      return null;
  }
}
