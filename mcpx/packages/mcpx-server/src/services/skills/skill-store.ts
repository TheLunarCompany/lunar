import { Skill, SkillDraft } from "@mcpx/shared-model";
import { SetPersonalSkillsPayload } from "@mcpx/webapp-protocol/messages";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

// Outbound authoring round-trips to Hub. The store delegates here, then ingests the
// Hub-persisted result (with its minted id) into local state. Production is satisfied by
// HubService / a socket client; tests pass a hand-crafted fake.
export interface SkillHubClient {
  createSkill(draft: SkillDraft): Promise<Skill>;
  updateSkill(id: string, draft: SkillDraft): Promise<Skill>;
  deleteSkill(id: string): Promise<void>;
}

// Only the owner's own skills exist (no sharing yet). `others` stays empty; it's kept so the
// shape doesn't churn when shared skills return.
export interface SkillCatalog {
  mine: Skill[];
  others: Skill[];
}

export interface SkillStoreI {
  applyPersonalSkills(payload: SetPersonalSkillsPayload): void;
  createSkill(draft: SkillDraft): Promise<Skill>;
  updateSkill(id: string, draft: SkillDraft): Promise<Skill>;
  deleteSkill(id: string): Promise<void>; // hard delete (mine only)
  getCatalog(): SkillCatalog;
  getById(id: string): Skill | undefined;
  subscribe(listener: () => void): () => void;
}

// Holds the pushed personal stream plus the local authoring surface.
export class SkillStore implements SkillStoreI {
  private readonly logger: Logger;
  private personalById = new Map<string, Skill>();
  private readonly listeners = new Set<() => void>();

  constructor(
    logger: Logger,
    private readonly hubClient: SkillHubClient,
  ) {
    this.logger = logger.child({ component: "SkillStore" });
  }

  applyPersonalSkills(payload: SetPersonalSkillsPayload): void {
    this.personalById = new Map(payload.skills.map((s) => [s.id, s]));
    this.logger.debug("Applied personal skills", {
      count: payload.skills.length,
    });
    this.notify();
  }

  // These round-trips are Hub-ACKed, but an ACK can report failure or time out. On failure
  // we throw and leave local state untouched. update/delete act on an existing id, so a retry
  // is naturally idempotent. create mints a new id, so a lost ACK is ambiguous: Hub may have
  // persisted the skill without us learning its id. Today the next authoritative push
  // (applyPersonalSkills) reconciles that. A client-supplied idempotency key would make create
  // retries safe (dedupe instead of duplicate); not implemented yet.
  // TODO: better resiliency
  async createSkill(draft: SkillDraft): Promise<Skill> {
    const skill = await this.hubClient.createSkill(draft);
    this.ingestPersonal(skill);
    return skill;
  }

  async updateSkill(id: string, draft: SkillDraft): Promise<Skill> {
    const skill = await this.hubClient.updateSkill(id, draft);
    this.ingestPersonal(skill);
    return skill;
  }

  async deleteSkill(id: string): Promise<void> {
    await this.hubClient.deleteSkill(id);
    this.personalById.delete(id);
    this.notify();
  }

  getCatalog(): SkillCatalog {
    const mine = Array.from(this.personalById.values());
    return structuredClone({ mine, others: [] });
  }

  getById(id: string): Skill | undefined {
    const skill = this.personalById.get(id);
    return skill ? structuredClone(skill) : undefined;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private ingestPersonal(skill: Skill): void {
    this.personalById.set(skill.id, skill);
    this.notify();
  }

  // Isolate listeners: a throwing subscriber must not skip the others or escape into
  // the hub push handler that drives applyPersonalSkills.
  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        this.logger.error("Skill store listener threw", loggableError(e));
      }
    });
  }
}
