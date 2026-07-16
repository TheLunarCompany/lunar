import type { EnabledSkills, Skill, SystemState } from "@mcpx/shared-model";
import type { CatalogMCPServerConfigByNameList } from "@mcpx/toolkit-ui/src/utils/server-helpers";

import type { Agent } from "../types/agent";
import { scopeSubjectKey } from "@mcpx/shared-model";
import { buildSkillProviderNameResolver } from "./skills";

export type AgentDrawerSkillProvider = {
  name: string;
  isMissingOrInactive: boolean;
};

export type AgentDrawerSkill = {
  id: string;
  name: string;
  description: string;
  href: string;
  providers: AgentDrawerSkillProvider[];
};

export function buildAgentDrawerSkills({
  agent,
  enabled,
  skills,
  systemState,
  catalogItems,
  targetServerAttributes,
  skillHref,
}: {
  agent: Agent;
  enabled: EnabledSkills[];
  skills: Skill[];
  systemState: SystemState | null | undefined;
  catalogItems?: CatalogMCPServerConfigByNameList;
  targetServerAttributes?: Record<string, { inactive?: boolean }>;
  skillHref: (id: string) => string;
}): AgentDrawerSkill[] {
  const subject = getAgentSkillSubject(agent);
  if (!subject) return [];

  const subjectKey = scopeSubjectKey(subject);
  const assignedSkillIds = new Set(
    enabled
      .filter((row) => scopeSubjectKey(row.subject) === subjectKey)
      .flatMap((row) => row.skillIds),
  );
  const resolveProviderNames = buildSkillProviderNameResolver(
    systemState,
    catalogItems,
  );
  const connectedServerNames = new Set(
    (systemState?.targetServers ?? []).map((server) =>
      normalizeName(server.name),
    ),
  );
  const inactiveServerNames = new Set(
    Object.entries(targetServerAttributes ?? {})
      .filter(([, attributes]) => attributes.inactive === true)
      .map(([name]) => normalizeName(name)),
  );

  return skills
    .filter((skill) => assignedSkillIds.has(skill.id))
    .sort(compareSkills)
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      href: skillHref(skill.id),
      providers: resolveProviderNames(skill.capabilityGroup).map((name) => ({
        name,
        isMissingOrInactive:
          (systemState != null &&
            !connectedServerNames.has(normalizeName(name))) ||
          inactiveServerNames.has(normalizeName(name)),
      })),
    }));
}

function compareSkills(a: Skill, b: Skill): number {
  const nameComparison = compareStrings(
    a.name.toLowerCase(),
    b.name.toLowerCase(),
  );
  return nameComparison !== 0 ? nameComparison : compareStrings(a.name, b.name);
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function getAgentSkillSubject(agent: Agent) {
  switch (agent.identityType) {
    case "consumerTag":
      return { kind: "consumerTag" as const, value: agent.consumerTag };
    case "clientName":
      return { kind: "clientName" as const, value: agent.clientName };
    case "anonymous":
      return null;
  }
}
