import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { Skill, SkillInput, SkillWithDraft } from "@mcpx/shared-model";
import { SaveDraftParams, SkillStore, SkillHubClient } from "./skill-store.js";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: "skill",
    description: "desc",
    body: "body",
    exposeAsPrompt: true,
    author: { setupOwnerId: "owner-1", displayName: "Owner One" },
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    publishedAt: null,
    ...overrides,
  };
}

// Records calls and returns whatever was set on it before the call, modelling the record
// Hub sends back (e.g. the minted skill). Throws if a create/update is hit without a return
// configured, so unconfigured calls surface instead of returning junk.
class FakeSkillHubClient implements SkillHubClient {
  public readonly createdInputs: SkillInput[] = [];
  public readonly updatedCalls: { id: string; input: SkillInput }[] = [];
  public readonly deletedIds: string[] = [];
  public readonly publishedIds: string[] = [];
  public readonly unpublishedIds: string[] = [];
  public readonly savedDraftCalls: SaveDraftParams[] = [];
  public readonly discardedDraftIds: string[] = [];
  public createReturn?: Skill;
  public updateReturn?: Skill;
  public publishReturn?: Skill;
  public unpublishReturn?: Skill;
  public saveDraftReturn?: SkillWithDraft;
  public discardDraftReturn?: SkillWithDraft;

  createSkill(input: SkillInput): Promise<Skill> {
    this.createdInputs.push(input);
    return this.respond(this.createReturn);
  }

  updateSkill(id: string, input: SkillInput): Promise<Skill> {
    this.updatedCalls.push({ id, input });
    return this.respond(this.updateReturn);
  }

  deleteSkill(id: string): Promise<void> {
    this.deletedIds.push(id);
    return Promise.resolve();
  }

  publishSkill(id: string): Promise<Skill> {
    this.publishedIds.push(id);
    return this.respond(this.publishReturn);
  }

  unpublishSkill(id: string): Promise<Skill> {
    this.unpublishedIds.push(id);
    return this.respond(this.unpublishReturn);
  }

  saveDraft(params: SaveDraftParams): Promise<SkillWithDraft> {
    this.savedDraftCalls.push(params);
    return this.respond(this.saveDraftReturn);
  }

  discardDraft(skillId: string): Promise<SkillWithDraft> {
    this.discardedDraftIds.push(skillId);
    return this.respond(this.discardDraftReturn);
  }

  private respond(skill: Skill | undefined): Promise<Skill> {
    if (!skill) {
      throw new Error("FakeSkillHubClient: no return configured");
    }
    return Promise.resolve(skill);
  }
}

const OWN_SETUP_OWNER_ID = "owner-self";

function makeStore(): { store: SkillStore; hub: FakeSkillHubClient } {
  const hub = new FakeSkillHubClient();
  const store = new SkillStore(noOpLogger, hub, OWN_SETUP_OWNER_ID);
  return { store, hub };
}

// Every round-trip rejects, standing in for a failed or timed-out Hub ACK.
class RejectingSkillHubClient implements SkillHubClient {
  constructor(private readonly error: Error) {}
  createSkill(): Promise<Skill> {
    return Promise.reject(this.error);
  }
  updateSkill(): Promise<Skill> {
    return Promise.reject(this.error);
  }
  deleteSkill(): Promise<void> {
    return Promise.reject(this.error);
  }
  publishSkill(): Promise<Skill> {
    return Promise.reject(this.error);
  }
  unpublishSkill(): Promise<Skill> {
    return Promise.reject(this.error);
  }
  saveDraft(): Promise<SkillWithDraft> {
    return Promise.reject(this.error);
  }
  discardDraft(): Promise<SkillWithDraft> {
    return Promise.reject(this.error);
  }
}

function makeRejectingStore(error = new Error("ack failed")): SkillStore {
  return new SkillStore(
    noOpLogger,
    new RejectingSkillHubClient(error),
    OWN_SETUP_OWNER_ID,
  );
}

const skillInput: SkillInput = {
  name: "new",
  description: "d",
  body: "b",
  exposeAsPrompt: true,
};

describe("SkillStore", () => {
  describe("apply + read", () => {
    it("applyPersonalSkills exposes the pushed skills under getCatalog().mine", () => {
      const { store } = makeStore();

      store.applyPersonalSkills({
        skills: [makeSkill({ id: "a" }), makeSkill({ id: "b" })],
      });

      expect(
        store
          .getCatalog()
          .mine.map((s) => s.id)
          .sort(),
      ).toEqual(["a", "b"]);
    });

    it("replaces (not merges) the personal stream on each apply", () => {
      const { store } = makeStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "a" })] });

      store.applyPersonalSkills({ skills: [makeSkill({ id: "b" })] });

      expect(store.getCatalog().mine.map((s) => s.id)).toEqual(["b"]);
    });

    it("getById returns the personal skill", () => {
      const { store } = makeStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "x" })] });

      expect(store.getById("x")?.id).toBe("x");
    });

    it("getById returns undefined for an unknown id", () => {
      const { store } = makeStore();
      expect(store.getById("nope")).toBeUndefined();
    });
  });

  describe("published stream", () => {
    it("exposes other owners' published skills under getCatalog().others", () => {
      const { store } = makeStore();

      store.applyPublishedSkills({
        skills: [makeSkill({ id: "p1", publishedAt: new Date() })],
      });

      expect(store.getCatalog().others.map((s) => s.id)).toEqual(["p1"]);
    });

    it("filters own-authored entries out of others (dedup vs the personal stream)", () => {
      const { store } = makeStore();
      const ownPublished = makeSkill({
        id: "own",
        author: { setupOwnerId: OWN_SETUP_OWNER_ID, displayName: "Me" },
        publishedAt: new Date(),
      });

      store.applyPersonalSkills({ skills: [ownPublished] });
      store.applyPublishedSkills({
        skills: [
          ownPublished,
          makeSkill({ id: "p1", publishedAt: new Date() }),
        ],
      });

      const catalog = store.getCatalog();
      expect(catalog.others.map((s) => s.id)).toEqual(["p1"]);
      expect(catalog.mine.map((s) => s.id)).toEqual(["own"]);
    });

    it("replaces (not merges) the published stream on each apply", () => {
      const { store } = makeStore();
      store.applyPublishedSkills({ skills: [makeSkill({ id: "p1" })] });

      store.applyPublishedSkills({ skills: [makeSkill({ id: "p2" })] });

      expect(store.getCatalog().others.map((s) => s.id)).toEqual(["p2"]);
    });
  });

  describe("getCatalog", () => {
    it("returns clones so mutating the result does not affect the store", () => {
      const { store } = makeStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "a" })] });

      const firstSkill = store.getCatalog().mine[0];
      if (firstSkill) {
        firstSkill.name = "mutated";
      }

      expect(store.getCatalog().mine[0]?.name).toBe("skill");
    });
  });

  describe("authoring round-trips", () => {
    it("createSkill delegates to the hub client and ingests the result", async () => {
      const minted = makeSkill({ id: "minted", name: "new" });
      const { store, hub } = makeStore();
      hub.createReturn = minted;

      const result = await store.createSkill(skillInput);

      expect(hub.createdInputs).toEqual([skillInput]);
      expect(result).toEqual(minted);
      expect(store.getById("minted")).toEqual(minted);
    });

    it("updateSkill delegates with the id and ingests the updated record", async () => {
      const before = makeSkill({ id: "s1", name: "before" });
      const { store, hub } = makeStore();
      store.applyPersonalSkills({ skills: [before] });

      const edit: SkillInput = { ...skillInput, name: "after" };
      hub.updateReturn = { ...before, name: "after" };
      const result = await store.updateSkill("s1", edit);

      expect(hub.updatedCalls).toEqual([{ id: "s1", input: edit }]);
      expect(result.name).toBe("after");
      expect(store.getById("s1")?.name).toBe("after");
    });

    it("deleteSkill delegates and removes the skill from the store", async () => {
      const { store, hub } = makeStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "s1" })] });

      await store.deleteSkill("s1");

      expect(hub.deletedIds).toEqual(["s1"]);
      expect(store.getById("s1")).toBeUndefined();
    });

    it("publishSkill delegates and ingests the stamped record", async () => {
      const { store, hub } = makeStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "s1" })] });
      const stamped = makeSkill({ id: "s1", publishedAt: new Date() });
      hub.publishReturn = stamped;

      const result = await store.publishSkill("s1");

      expect(hub.publishedIds).toEqual(["s1"]);
      expect(result).toEqual(stamped);
      expect(store.getById("s1")?.publishedAt).toEqual(stamped.publishedAt);
    });

    it("unpublishSkill delegates and ingests the nullified record", async () => {
      const { store, hub } = makeStore();
      store.applyPersonalSkills({
        skills: [makeSkill({ id: "s1", publishedAt: new Date() })],
      });
      hub.unpublishReturn = makeSkill({ id: "s1", publishedAt: null });

      await store.unpublishSkill("s1");

      expect(hub.unpublishedIds).toEqual(["s1"]);
      expect(store.getById("s1")?.publishedAt).toBeNull();
    });
  });

  describe("drafts", () => {
    const overlay = {
      description: "drafted desc",
      body: "drafted body",
      exposeAsPrompt: false,
    };

    it("saveDraft delegates and ingests the draft-carrying record", async () => {
      const { store, hub } = makeStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "s1" })] });
      const base = new Date("2026-01-01T00:00:00Z");
      hub.saveDraftReturn = { ...makeSkill({ id: "s1" }), draft: overlay };

      const result = await store.saveDraft({
        skillId: "s1",
        draft: overlay,
        baseUpdatedAt: base,
      });

      expect(hub.savedDraftCalls).toEqual([
        { skillId: "s1", draft: overlay, baseUpdatedAt: base },
      ]);
      expect(result.draft).toEqual(overlay);
      expect(store.getById("s1")?.draft).toEqual(overlay);
    });

    it("discardDraft delegates and ingests the draft-free record", async () => {
      const { store, hub } = makeStore();
      store.applyPersonalSkills({
        skills: [{ ...makeSkill({ id: "s1" }), draft: overlay }],
      });
      hub.discardDraftReturn = makeSkill({ id: "s1" });

      await store.discardDraft("s1");

      expect(hub.discardedDraftIds).toEqual(["s1"]);
      expect(store.getById("s1")?.draft).toBeUndefined();
    });

    it("getEffectiveById overlays the draft fields and keeps saved metadata", () => {
      const { store } = makeStore();
      const saved = makeSkill({ id: "s1", publishedAt: new Date(7) });
      store.applyPersonalSkills({ skills: [{ ...saved, draft: overlay }] });

      const effective = store.getEffectiveById("s1");

      expect(effective).toEqual({
        id: saved.id,
        author: saved.author,
        name: saved.name,
        updatedAt: saved.updatedAt,
        publishedAt: saved.publishedAt,
        ...overlay,
      });
    });

    it("a draft without a capabilityGroup clears the saved one in the effective view", () => {
      const { store } = makeStore();
      const saved = makeSkill({
        id: "s1",
        capabilityGroup: { items: [] },
      });

      store.applyPersonalSkills({ skills: [saved] });
      // before
      expect(store.getEffectiveById("s1")?.capabilityGroup).toEqual({
        items: [],
      });

      // apply a draft that does not include capabilityGroup
      store.applyPersonalSkills({ skills: [{ ...saved, draft: overlay }] });

      // after
      expect(store.getEffectiveById("s1")?.capabilityGroup).toBeUndefined();
    });

    it("without a draft, effective reads equal the saved skill", () => {
      const { store } = makeStore();
      const saved = makeSkill({ id: "s1" });
      store.applyPersonalSkills({ skills: [saved] });

      expect(store.getEffectiveById("s1")).toEqual(saved);
      expect(store.getEffectiveMine()).toEqual([saved]);
    });

    it("getEffectiveMine overlays only the drafted skills", () => {
      const { store } = makeStore();
      const plain = makeSkill({ id: "plain" });
      const drafted = { ...makeSkill({ id: "drafted" }), draft: overlay };
      store.applyPersonalSkills({ skills: [plain, drafted] });

      const byId = new Map(store.getEffectiveMine().map((s) => [s.id, s]));
      expect(byId.get("plain")?.body).toBe(plain.body);
      expect(byId.get("drafted")?.body).toBe(overlay.body);
    });

    it("saveDraft rejects without touching local state", async () => {
      const store = makeRejectingStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "s1" })] });

      await expect(
        store.saveDraft({
          skillId: "s1",
          draft: overlay,
          baseUpdatedAt: new Date(),
        }),
      ).rejects.toThrow("ack failed");

      expect(store.getById("s1")?.draft).toBeUndefined();
    });
  });

  describe("hub ack failure", () => {
    it("createSkill rejects and leaves local state untouched", async () => {
      const store = makeRejectingStore();
      let notified = 0;
      store.subscribe(() => {
        notified += 1;
      });

      await expect(store.createSkill(skillInput)).rejects.toThrow("ack failed");

      expect(store.getCatalog().mine).toHaveLength(0);
      expect(notified).toBe(0);
    });

    it("updateSkill rejects without mutating the prior skill", async () => {
      const store = makeRejectingStore();
      store.applyPersonalSkills({
        skills: [makeSkill({ id: "s1", name: "before" })],
      });

      await expect(
        store.updateSkill("s1", { ...skillInput, name: "after" }),
      ).rejects.toThrow("ack failed");

      expect(store.getById("s1")?.name).toBe("before");
    });

    it("deleteSkill rejects without removing the skill locally", async () => {
      const store = makeRejectingStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "s1" })] });

      await expect(store.deleteSkill("s1")).rejects.toThrow("ack failed");

      expect(store.getById("s1")?.id).toBe("s1");
    });

    it("publishSkill rejects without stamping the local skill", async () => {
      const store = makeRejectingStore();
      store.applyPersonalSkills({ skills: [makeSkill({ id: "s1" })] });

      await expect(store.publishSkill("s1")).rejects.toThrow("ack failed");

      expect(store.getById("s1")?.publishedAt).toBeNull();
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

      store.applyPersonalSkills({ skills: [] });
      await store.createSkill(skillInput);
      expect(count).toBe(2);

      unsubscribe();
      store.applyPersonalSkills({ skills: [] });
      expect(count).toBe(2);
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

      expect(() => store.applyPersonalSkills({ skills: [] })).not.toThrow();
      expect(reached).toBe(true);
    });
  });
});
