import { Skill } from "@mcpx/shared-model";
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

  createSkill(): Promise<Skill> {
    return this.reject();
  }

  updateSkill(): Promise<Skill> {
    return this.reject();
  }

  deleteSkill(): Promise<void> {
    return this.reject();
  }

  publishSkill(): Promise<Skill> {
    return this.reject();
  }

  unpublishSkill(): Promise<Skill> {
    return this.reject();
  }

  getCatalog(): SkillCatalog {
    return { mine: [], others: [] };
  }

  getById(): Skill | undefined {
    return undefined;
  }

  subscribe(): () => void {
    return () => {};
  }

  private reject(): Promise<never> {
    return Promise.reject(new Error("Skills require a Hub connection"));
  }
}
