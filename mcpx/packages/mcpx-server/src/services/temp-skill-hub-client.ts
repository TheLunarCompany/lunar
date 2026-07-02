import { Skill, SkillAuthor, SkillDraft } from "@mcpx/shared-model";
import { v7 as uuidv7 } from "uuid";
import { env } from "../env.js";
import { IdentityServiceI } from "./identity-service.js";
import { SkillHubClient } from "./skill-store.js";

// TEMP (RND-823): stands in for the real Hub authoring round-trip, which has no wire
// contract yet. In-memory so colleagues can dev the authoring UI against working CRUD:
// it mints ids, persists, and returns the stored record like Hub eventually will.
export class TempSkillHubClient implements SkillHubClient {
  private readonly byId = new Map<string, Skill>();

  constructor(private readonly identityService: IdentityServiceI) {}

  createSkill(draft: SkillDraft): Promise<Skill> {
    const skill: Skill = {
      ...draft,
      id: uuidv7(),
      author: this.author(),
      updatedAt: new Date(),
    };
    this.byId.set(skill.id, skill);
    return Promise.resolve(skill);
  }

  updateSkill(id: string, draft: SkillDraft): Promise<Skill> {
    const existing = this.byId.get(id);
    if (!existing) {
      return Promise.reject(new Error(`No skill with id ${id}`));
    }
    const skill: Skill = { ...existing, ...draft, id, updatedAt: new Date() };
    this.byId.set(id, skill);
    return Promise.resolve(skill);
  }

  deleteSkill(id: string): Promise<void> {
    this.byId.delete(id);
    return Promise.resolve();
  }

  private author(): SkillAuthor {
    return {
      setupOwnerId: env.INSTANCE_KEY ?? "Personal user",
      displayName: this.identityService.getDisplayName() ?? "Personal User",
    };
  }
}
