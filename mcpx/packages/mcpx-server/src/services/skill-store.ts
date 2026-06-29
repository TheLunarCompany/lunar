import { Skill, SkillDraft } from "@mcpx/shared-model";
import {
  SetSharedSkillsPayload,
  SetPersonalSkillsPayload,
} from "@mcpx/webapp-protocol/messages";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

// Outbound authoring round-trips to Hub. The store delegates here, then ingests the
// Hub-persisted result (with its minted id) into local state. Production is satisfied by
// HubService / a socket client; tests pass a hand-crafted fake.
export interface SkillHubClient {
  createSkill(draft: SkillDraft): Promise<Skill>;
  shareSkill(id: string): Promise<Skill>;
  deleteSkill(params: { id: string; reason?: string }): Promise<Skill>;
}

// Partitioned by ownership. mine = authored by us (the owner-only personal stream, shared
// or not). others = skills authored by others, which reach us only because they are shared.
// This is a derived view of the streams arriving over the websocket, the shape MCPX itself
// cares about.
export interface SkillCatalog {
  mine: Skill[];
  others: Skill[];
}

export interface SkillStoreI {
  // apply* are named after the push streams they ingest (not the { mine, others } view).
  applySharedSkills(payload: SetSharedSkillsPayload): void;
  applyPersonalSkills(payload: SetPersonalSkillsPayload): void;
  createSkill(draft: SkillDraft): Promise<Skill>;
  shareSkill(id: string): Promise<Skill>;
  deleteSkill(params: { id: string; reason?: string }): Promise<Skill>; // soft-delete!
  getCatalog(): SkillCatalog;
  getById(id: string): Skill | undefined;
  subscribe(listener: () => void): () => void;
}

// Holds the two pushed streams (shared: org-wide, personal: owner-only) and the local authoring surface.
export class SkillStore implements SkillStoreI {
  private readonly logger: Logger;
  private sharedById = new Map<string, Skill>();
  private personalById = new Map<string, Skill>();
  private readonly listeners = new Set<() => void>();

  constructor(
    logger: Logger,
    private readonly hubClient: SkillHubClient,
  ) {
    this.logger = logger.child({ component: "SkillStore" });
  }

  applySharedSkills(payload: SetSharedSkillsPayload): void {
    this.sharedById = new Map(payload.skills.map((s) => [s.id, s]));
    this.logger.debug("Applied shared skills", {
      count: payload.skills.length,
    });
    this.notify();
  }

  applyPersonalSkills(payload: SetPersonalSkillsPayload): void {
    this.personalById = new Map(payload.skills.map((s) => [s.id, s]));
    this.logger.debug("Applied personal skills", {
      count: payload.skills.length,
    });
    this.notify();
  }

  // These round-trips are Hub-ACKed, but an ACK can report failure or time out. On failure
  // we throw and leave local state untouched. share/delete act on an existing id, so a retry
  // is naturally idempotent. create mints a new id, so a lost ACK is ambiguous: Hub may have
  // persisted the skill without us learning its id. Today the next authoritative push
  // (applyShared/applyPersonalSkills) reconciles that. A client-supplied idempotency key would
  // make create retries safe (dedupe instead of duplicate); not implemented yet.
  // TODO RND-823: better resiliency
  async createSkill(draft: SkillDraft): Promise<Skill> {
    const skill = await this.hubClient.createSkill(draft);
    this.ingestPersonal(skill);
    return skill;
  }

  async shareSkill(id: string): Promise<Skill> {
    const skill = await this.hubClient.shareSkill(id);
    this.ingestPersonal(skill);
    return skill;
  }

  async deleteSkill(params: { id: string; reason?: string }): Promise<Skill> {
    const skill = await this.hubClient.deleteSkill(params);
    this.ingestPersonal(skill);
    return skill;
  }

  // A skill we authored and shared lands on both streams; keep it under `mine` only.
  getCatalog(): SkillCatalog {
    const mine = Array.from(this.personalById.values());
    const others = Array.from(this.sharedById.values()).filter(
      (skill) => !this.personalById.has(skill.id),
    );
    return structuredClone({ mine, others });
  }

  getById(id: string): Skill | undefined {
    const skill = this.personalById.get(id) ?? this.sharedById.get(id);
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
  // the hub push handler that drives applySharedSkills / applyPersonalSkills.
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
