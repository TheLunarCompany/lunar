import {
  Skill,
  SkillDraftOverlay,
  SkillInput,
  SkillWithDraft,
} from "@mcpx/shared-model";
import {
  SetPersonalSkillsPayload,
  SetPublishedSkillsPayload,
} from "@mcpx/webapp-protocol/messages";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

// Outbound authoring round-trips to Hub. The store delegates here, then ingests the
// Hub-persisted result (with its minted id) into local state. Production is satisfied by
// HubService / a socket client; tests pass a hand-crafted fake.
export interface SkillHubClient {
  createSkill(input: SkillInput): Promise<SkillWithDraft>;
  updateSkill(id: string, input: SkillInput): Promise<SkillWithDraft>;
  deleteSkill(id: string): Promise<void>;
  publishSkill(id: string): Promise<SkillWithDraft>;
  unpublishSkill(id: string): Promise<SkillWithDraft>;
  saveDraft(params: SaveDraftParams): Promise<SkillWithDraft>;
  discardDraft(skillId: string): Promise<SkillWithDraft>;
}

export interface SaveDraftParams {
  skillId: string;
  draft: SkillDraftOverlay;
  baseUpdatedAt: Date;
}

// Hub rejected a draft save: the skill's updatedAt moved past the draft's
// baseUpdatedAt. Callers answer 409.
export class StaleDraftBaseError extends Error {
  constructor() {
    super("Skill changed since the draft's base");
    this.name = "StaleDraftBaseError";
  }
}

// mine = the personal stream (all of this owner's skills, published or not).
// others = the org-wide published stream minus this owner's own entries.
export interface SkillCatalog {
  mine: SkillWithDraft[];
  others: Skill[];
}

export interface SkillStoreI {
  applyPersonalSkills(payload: SetPersonalSkillsPayload): void;
  applyPublishedSkills(payload: SetPublishedSkillsPayload): void;
  createSkill(input: SkillInput): Promise<SkillWithDraft>;
  updateSkill(id: string, input: SkillInput): Promise<SkillWithDraft>;
  deleteSkill(id: string): Promise<void>; // hard delete (mine only)
  publishSkill(id: string): Promise<SkillWithDraft>;
  unpublishSkill(id: string): Promise<SkillWithDraft>;
  saveDraft(params: SaveDraftParams): Promise<SkillWithDraft>;
  discardDraft(id: string): Promise<SkillWithDraft>;
  getCatalog(): SkillCatalog;
  getById(id: string): SkillWithDraft | undefined;
  // Draft-overlaid reads; what the serving path projects.
  getEffectiveById(id: string): Skill | undefined;
  getEffectiveMine(): Skill[];
  subscribe(listener: () => void): () => void;
}

// Holds the two pushed streams (personal + org-wide published) plus the local
// authoring surface. Both maps mirror the wire faithfully; dedup between them
// happens on read (getCatalog filters published by this instance's own owner).
export class SkillStore implements SkillStoreI {
  private readonly logger: Logger;
  private personalById = new Map<string, SkillWithDraft>();
  private publishedById = new Map<string, Skill>();
  private readonly listeners = new Set<() => void>();

  constructor(
    logger: Logger,
    private readonly hubClient: SkillHubClient,
    private readonly ownSetupOwnerId: string,
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

  applyPublishedSkills(payload: SetPublishedSkillsPayload): void {
    this.publishedById = new Map(payload.skills.map((s) => [s.id, s]));
    this.logger.debug("Applied published skills", {
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
  async createSkill(input: SkillInput): Promise<SkillWithDraft> {
    const skill = await this.hubClient.createSkill(input);
    this.ingestPersonal(skill);
    return skill;
  }

  async updateSkill(id: string, input: SkillInput): Promise<SkillWithDraft> {
    const skill = await this.hubClient.updateSkill(id, input);
    this.ingestPersonal(skill);
    return skill;
  }

  async deleteSkill(id: string): Promise<void> {
    await this.hubClient.deleteSkill(id);
    this.personalById.delete(id);
    this.notify();
  }

  async publishSkill(id: string): Promise<SkillWithDraft> {
    const skill = await this.hubClient.publishSkill(id);
    this.ingestPersonal(skill);
    return skill;
  }

  async unpublishSkill(id: string): Promise<SkillWithDraft> {
    const skill = await this.hubClient.unpublishSkill(id);
    this.ingestPersonal(skill);
    return skill;
  }

  async saveDraft(params: SaveDraftParams): Promise<SkillWithDraft> {
    const skill = await this.hubClient.saveDraft(params);
    this.ingestPersonal(skill);
    return skill;
  }

  async discardDraft(id: string): Promise<SkillWithDraft> {
    const skill = await this.hubClient.discardDraft(id);
    this.ingestPersonal(skill);
    return skill;
  }

  getCatalog(): SkillCatalog {
    const mine = Array.from(this.personalById.values());
    // Must be O(n) (map is by *skill* id), but it's a small n and occurs on the instance-level on demand
    const others = Array.from(this.publishedById.values()).filter(
      (s) => s.author.setupOwnerId !== this.ownSetupOwnerId,
    );
    return structuredClone({ mine, others });
  }

  getById(id: string): SkillWithDraft | undefined {
    const skill = this.personalById.get(id);
    return skill ? structuredClone(skill) : undefined;
  }

  getEffectiveById(id: string): Skill | undefined {
    const skill = this.personalById.get(id);
    return skill ? structuredClone(effective(skill)) : undefined;
  }

  getEffectiveMine(): Skill[] {
    return structuredClone(
      Array.from(this.personalById.values()).map(effective),
    );
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

// The overlay rule: metadata stays saved, every draftable field comes from the
// draft — including capabilityGroup, whose absence in the draft clears the
// saved one (spreading draft over the full saved skill would leak it).
function effective(skill: SkillWithDraft): Skill {
  const { draft, ...saved } = skill;
  if (!draft) {
    return saved;
  }
  const { id, author, name, updatedAt, publishedAt } = saved;
  return { id, author, name, updatedAt, publishedAt, ...draft };
}
