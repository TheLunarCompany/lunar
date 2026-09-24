import { EnabledSkills, Skill, scopeSubjectKey } from "@mcpx/shared-model";
import { indexBy, mapValues, partition } from "@mcpx/toolkit-core/data";
import { Logger } from "winston";
import { CapabilityKind } from "../capability-registry.js";
import {
  buildScopeIndex,
  ScopedGroups,
  ScopeIndex,
  subjectScopeAllows,
} from "../capability-scope.js";
import { ConsumerContext, PermissionCheck } from "../capability-resolver.js";

// The skill-aware face of capability scoping: joins the enabled-skills config
// with the stored skills and answers the resolver's permission checks through
// the scope engine. Subject resolution precedence mirrors PermissionManager:
// consumerTag > clientName > none (none = unrestricted).

export interface SkillScopeDeps {
  getEnabledSkills: () => EnabledSkills[];
  getSkills: () => Skill[];
  getCatalogItemId: (serverName: string) => string | undefined;
}

export class SkillScope implements PermissionCheck {
  private index: ScopeIndex = new Map();
  private enabledBySubject: Record<string, Set<string>> = {};
  private readonly logger: Logger;

  constructor(
    private readonly deps: SkillScopeDeps,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "SkillScope" });
    this.refresh();
  }

  // Rebuilds the projections; call on config or skill-store change.
  refresh(): void {
    const skills = this.deps.getSkills();
    const enabled = this.cleanEnabled(this.deps.getEnabledSkills(), skills);
    this.index = buildScopeIndex(deriveScopedGroups({ enabled, skills }));
    this.enabledBySubject = mapValues(
      indexBy(enabled, (entry) => scopeSubjectKey(entry.subject)),
      (entry) => new Set(entry.skillIds),
    );
  }

  hasPermission(props: {
    capabilityKind: CapabilityKind;
    serviceName: string;
    capabilityName: string;
    clientName?: string;
    consumerTag?: string;
  }): boolean {
    const { capabilityKind, serviceName, capabilityName, ...consumer } = props;
    const subjectKey = this.subjectKeyFor(consumer);
    if (!subjectKey) {
      // No subject with skills enabled; unrestricted.
      return true;
    }
    const scope = this.index.get(subjectKey);
    if (!scope) {
      // Skills are enabled for this subject but none selects capabilities.
      return true;
    }
    const catalogItemId = this.deps.getCatalogItemId(serviceName);
    if (!catalogItemId) {
      // No catalog item for this server; deny by default.
      return false;
    }
    return subjectScopeAllows({
      scope,
      kind: capabilityKind,
      catalogItemId,
      capability: capabilityName,
    });
  }

  // Whether the skill itself (its resource/prompt faces) is on for this
  // consumer. Answered from the raw enabled-map, not the scope index: a
  // group-less skill is enabled even though it contributes no scope.
  isEnabled(consumer: ConsumerContext, skillId: string): boolean {
    const subjectKey = this.subjectKeyFor(consumer);
    if (!subjectKey) return false;
    return this.enabledBySubject[subjectKey]?.has(skillId) ?? false;
  }

  // Skill ids with no stored skill are an illegal state (deleted skill, config
  // out of sync). Drop them, and drop entries left empty, so a fully-dangling
  // subject does not govern its consumers.
  private cleanEnabled(
    enabled: EnabledSkills[],
    skills: Skill[],
  ): EnabledSkills[] {
    const knownIds = new Set(skills.map((skill) => skill.id));
    const split = enabled.map((entry) => {
      const [known, unknown] = partition(entry.skillIds, (id) =>
        knownIds.has(id),
      );
      return { subject: entry.subject, known, unknown };
    });

    const dangling = split
      .filter((entry) => entry.unknown.length)
      .map((entry) => ({ subject: entry.subject, skillIds: entry.unknown }));
    if (dangling.length) {
      this.logger.warn("Enabled skills reference unknown skill ids", {
        dangling,
      });
    }

    return split
      .filter((entry) => entry.known.length)
      .map((entry) => ({ subject: entry.subject, skillIds: entry.known }));
  }

  // The subject this consumer falls under: its consumerTag if that has skills
  // enabled, else its clientName if that has. Checked against the enabled
  // config (not the index) so a subject with only group-less skills still wins.
  private subjectKeyFor(consumer: ConsumerContext): string | undefined {
    const { consumerTag, clientName } = consumer;
    if (consumerTag) {
      const key = scopeSubjectKey({ kind: "consumerTag", value: consumerTag });
      if (this.enabledBySubject[key]) return key;
    }
    if (clientName) {
      const key = scopeSubjectKey({ kind: "clientName", value: clientName });
      if (this.enabledBySubject[key]) return key;
    }
    return undefined;
  }
}

// A skill id with no stored skill contributes nothing; a group-less skill is
// capability-neutral.
function deriveScopedGroups(props: {
  enabled: EnabledSkills[];
  skills: Skill[];
}): ScopedGroups[] {
  const { enabled, skills } = props;
  const skillsById = indexBy(skills, (skill) => skill.id);
  return enabled.map(({ subject, skillIds }) => ({
    subject,
    groupItems: skillIds.flatMap(
      (id) => skillsById[id]?.capabilityGroup?.items ?? [],
    ),
  }));
}
