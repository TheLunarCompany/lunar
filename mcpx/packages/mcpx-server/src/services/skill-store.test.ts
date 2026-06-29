import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { Skill, SkillDraft } from "@mcpx/shared-model";
import { SkillStore, SkillHubClient } from "./skill-store.js";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: "skill",
    description: "desc",
    body: "body",
    exposeAsPrompt: true,
    author: { setupOwnerId: "owner-1", displayName: "Owner One" },
    isShared: false,
    deletion: null,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// Records calls and returns whatever was set on it before the call, modelling the record
// Hub sends back (e.g. the now-shared skill). Throws if a method is hit without a return
// configured, so unconfigured calls surface instead of returning junk.
class FakeSkillHubClient implements SkillHubClient {
  public readonly createdDrafts: SkillDraft[] = [];
  public readonly sharedIds: string[] = [];
  public readonly deletedParams: { id: string; reason?: string }[] = [];
  public createReturn?: Skill;
  public shareReturn?: Skill;
  public deleteReturn?: Skill;

  createSkill(draft: SkillDraft): Promise<Skill> {
    this.createdDrafts.push(draft);
    return this.respond(this.createReturn);
  }

  shareSkill(id: string): Promise<Skill> {
    this.sharedIds.push(id);
    return this.respond(this.shareReturn);
  }

  deleteSkill(params: { id: string; reason?: string }): Promise<Skill> {
    this.deletedParams.push(params);
    return this.respond(this.deleteReturn);
  }

  private respond(skill: Skill | undefined): Promise<Skill> {
    if (!skill) {
      throw new Error("FakeSkillHubClient: no return configured");
    }
    return Promise.resolve(skill);
  }
}

function makeStore(): { store: SkillStore; hub: FakeSkillHubClient } {
  const hub = new FakeSkillHubClient();
  const store = new SkillStore(noOpLogger, hub);
  return { store, hub };
}

// Every round-trip rejects, standing in for a failed or timed-out Hub ACK.
class RejectingSkillHubClient implements SkillHubClient {
  constructor(private readonly error: Error) {}
  createSkill(): Promise<Skill> {
    return Promise.reject(this.error);
  }
  shareSkill(): Promise<Skill> {
    return Promise.reject(this.error);
  }
  deleteSkill(): Promise<Skill> {
    return Promise.reject(this.error);
  }
}

function makeRejectingStore(error = new Error("ack failed")): SkillStore {
  return new SkillStore(noOpLogger, new RejectingSkillHubClient(error));
}

describe("SkillStore", () => {
  describe("apply + read", () => {
    it("applySharedSkills exposes the pushed skills under getCatalog().others", () => {
      const { store } = makeStore();
      const a = makeSkill({ id: "a" });
      const b = makeSkill({ id: "b" });

      store.applySharedSkills({ skills: [a, b] });

      expect(
        store
          .getCatalog()
          .others.map((s) => s.id)
          .sort(),
      ).toEqual(["a", "b"]);
    });

    it("applyPersonalSkills exposes the pushed skills under getCatalog().mine", () => {
      const { store } = makeStore();

      store.applyPersonalSkills({ skills: [makeSkill({ id: "a" })] });

      expect(store.getCatalog().mine.map((s) => s.id)).toEqual(["a"]);
    });

    it("replaces (not merges) the shared stream on each apply", () => {
      const { store } = makeStore();
      store.applySharedSkills({ skills: [makeSkill({ id: "a" })] });

      store.applySharedSkills({ skills: [makeSkill({ id: "b" })] });

      expect(store.getCatalog().others.map((s) => s.id)).toEqual(["b"]);
    });

    it("getById prefers the personal copy over the shared copy", () => {
      // unrealistic and not really possible that same id will be shared, yet...
      const { store } = makeStore();
      store.applySharedSkills({
        skills: [makeSkill({ id: "x", isShared: true })],
      });
      expect(store.getById("x")?.isShared).toBe(true);
      store.applyPersonalSkills({
        skills: [makeSkill({ id: "x", isShared: false })],
      });

      expect(store.getById("x")?.isShared).toBe(false);
    });

    it("getById returns undefined for an unknown id", () => {
      const { store } = makeStore();
      expect(store.getById("nope")).toBeUndefined();
    });
  });

  describe("getCatalog partition", () => {
    it("puts a self-authored shared skill only under mine, not others", () => {
      const { store } = makeStore();
      store.applySharedSkills({
        skills: [makeSkill({ id: "x", isShared: true })],
      });
      store.applyPersonalSkills({
        skills: [makeSkill({ id: "x", isShared: true, body: "mine" })],
      });

      const catalog = store.getCatalog();

      expect(catalog.others).toHaveLength(0);
      expect(catalog.mine).toHaveLength(1);
      expect(catalog.mine[0]?.body).toBe("mine");
    });

    it("keeps others' shared skills under others, separate from mine", () => {
      const { store } = makeStore();
      store.applySharedSkills({
        skills: [
          makeSkill({ id: "theirs-1", isShared: true }),
          makeSkill({ id: "theirs-2", isShared: true }),
        ],
      });
      store.applyPersonalSkills({ skills: [makeSkill({ id: "mine-1" })] });

      const catalog = store.getCatalog();

      expect(catalog.others.map((s) => s.id).sort()).toEqual([
        "theirs-1",
        "theirs-2",
      ]);
      expect(catalog.mine.map((s) => s.id)).toEqual(["mine-1"]);
    });

    it("returns clones so mutating the result does not affect the store", () => {
      const { store } = makeStore();
      store.applySharedSkills({ skills: [makeSkill({ id: "a" })] });

      const firstSkill = store.getCatalog().others[0];
      if (firstSkill) {
        firstSkill.name = "mutated";
      }

      expect(store.getCatalog().others[0]?.name).toBe("skill");
    });
  });

  describe("authoring round-trips", () => {
    const draft: SkillDraft = {
      name: "new",
      description: "d",
      body: "b",
      exposeAsPrompt: true,
    };

    it("createSkill delegates to the hub client and ingests the result", async () => {
      const minted = makeSkill({ id: "minted", name: "new" });
      const { store, hub } = makeStore();
      hub.createReturn = minted;

      const result = await store.createSkill(draft);

      expect(hub.createdDrafts).toEqual([draft]);
      expect(result).toEqual(minted);
      expect(store.getById("minted")).toEqual(minted);
    });

    it("shareSkill flips the prior skill from private to shared", async () => {
      const before = makeSkill({ id: "s1", isShared: false });
      const { store, hub } = makeStore();
      store.applyPersonalSkills({ skills: [before] });
      expect(store.getById("s1")?.isShared).toBe(false);

      // Hub marks it shared and returns the updated record.
      hub.shareReturn = { ...before, isShared: true };
      await store.shareSkill("s1");

      expect(hub.sharedIds).toEqual(["s1"]);
      expect(store.getById("s1")?.isShared).toBe(true);
    });

    it("deleteSkill ingests the soft-deleted skill with its reason", async () => {
      const before = makeSkill({ id: "s1" });
      const { store, hub } = makeStore();
      store.applyPersonalSkills({ skills: [before] });

      // Hub records the soft-delete and returns the updated record.
      hub.deleteReturn = {
        ...before,
        deletion: { bySetupOwnerId: "owner-1", reason: "stale" },
      };
      await store.deleteSkill({ id: "s1", reason: "stale" });

      expect(hub.deletedParams).toEqual([{ id: "s1", reason: "stale" }]);
      expect(store.getById("s1")?.deletion).toEqual({
        bySetupOwnerId: "owner-1",
        reason: "stale",
      });
    });
  });

  describe("hub ack failure", () => {
    const draft: SkillDraft = {
      name: "new",
      description: "d",
      body: "b",
      exposeAsPrompt: true,
    };

    it("createSkill rejects and leaves local state untouched", async () => {
      const store = makeRejectingStore();
      let notified = 0;
      store.subscribe(() => {
        notified += 1;
      });

      await expect(store.createSkill(draft)).rejects.toThrow("ack failed");

      expect(store.getCatalog().mine).toHaveLength(0);
      expect(notified).toBe(0);
    });

    it("shareSkill rejects without mutating the prior skill", async () => {
      const store = makeRejectingStore();
      store.applyPersonalSkills({
        skills: [makeSkill({ id: "s1", isShared: false })],
      });

      await expect(store.shareSkill("s1")).rejects.toThrow("ack failed");

      expect(store.getById("s1")?.isShared).toBe(false);
    });

    it("deleteSkill rejects without soft-deleting locally", async () => {
      const store = makeRejectingStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "s1" })] });

      await expect(store.deleteSkill({ id: "s1" })).rejects.toThrow(
        "ack failed",
      );

      expect(store.getById("s1")?.deletion).toBeNull();
    });
  });

  describe("subscribe", () => {
    it("notifies listeners on apply and on authoring, until unsubscribed", async () => {
      const { store, hub } = makeStore();
      hub.createReturn = makeSkill({ id: "m" });
      let count = 0;
      const unsubscribe = store.subscribe(() => {
        count += 1;
      });

      store.applySharedSkills({ skills: [] });
      store.applyPersonalSkills({ skills: [] });
      await store.createSkill({
        name: "n",
        description: "d",
        body: "b",
        exposeAsPrompt: true,
      });
      expect(count).toBe(3);

      unsubscribe();
      store.applySharedSkills({ skills: [] });
      expect(count).toBe(3);
    });

    it("a throwing listener does not skip others or escape the apply", () => {
      const { store } = makeStore();
      let reached = false;
      store.subscribe(() => {
        throw new Error("boom");
      });
      store.subscribe(() => {
        reached = true;
      });

      expect(() => store.applySharedSkills({ skills: [] })).not.toThrow();
      expect(reached).toBe(true);
    });
  });
});
