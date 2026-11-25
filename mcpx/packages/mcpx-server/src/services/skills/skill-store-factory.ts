import { Skill, SkillWithDraft } from "@mcpx/shared-model";
import { Logger } from "winston";
import { env } from "../../env.js";
import { HubSocketAdapter } from "../saved-setups-client.js";
import { HubSkillClient } from "./hub-skill-client.js";
import { SkillCatalog, SkillStore, SkillStoreI } from "./skill-store.js";

// INSTANCE_KEY is the setupOwnerId this instance authenticates to the Hub with —
// the same identity the published stream's author field carries. Its absence
// means personal mode: no Hub, hence no skills.
export function buildSkillStore(
  getSocketAdapter: () => HubSocketAdapter | null,
  logger: Logger,
): SkillStoreI {
  if (!env.INSTANCE_KEY) {
    return new NoOpSkillStore();
  }
  return new SkillStore(
    logger,
    new HubSkillClient(getSocketAdapter, logger),
    env.INSTANCE_KEY,
  );
}

// Reads answer empty, writes reject. A future disk-based store may replace this.
class NoOpSkillStore implements SkillStoreI {
  applyPersonalSkills(): void {}

  applyPublishedSkills(): void {}

  createSkill(): Promise<SkillWithDraft> {
    return this.reject();
  }

  updateSkill(): Promise<SkillWithDraft> {
    return this.reject();
  }

  deleteSkill(): Promise<void> {
    return this.reject();
  }

  publishSkill(): Promise<SkillWithDraft> {
    return this.reject();
  }

  unpublishSkill(): Promise<SkillWithDraft> {
    return this.reject();
  }

  saveDraft(): Promise<SkillWithDraft> {
    return this.reject();
  }

  discardDraft(): Promise<SkillWithDraft> {
    return this.reject();
  }

  getCatalog(): SkillCatalog {
    return { mine: [], others: [] };
  }

  getById(): SkillWithDraft | undefined {
    return undefined;
  }

  getEffectiveById(): Skill | undefined {
    return undefined;
  }

  getEffectiveMine(): Skill[] {
    return [];
  }

  subscribe(): () => void {
    return () => {};
  }

  private reject(): Promise<never> {
    return Promise.reject(new Error("Skills require a Hub connection"));
  }
}
