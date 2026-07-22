import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { Skill, SkillDraft } from "@mcpx/shared-model";
import { SetPersonalSkillsPayload } from "@mcpx/webapp-protocol/messages";
import { CapabilityRegistry } from "../capability-registry.js";
import {
  ActivePrompt,
  ActiveResource,
  ConsumerContext,
} from "../capability-resolver.js";
import { InternalCapabilitiesService } from "../internal-capabilities-service.js";
import { SkillCatalog, SkillStoreI } from "./skill-store.js";
import {
  parseIdFromSkillUri,
  SkillResourceProjector,
  SKILLS_SERVICE_NAME,
  skillToSkillMd,
  skillUri,
} from "./skill-resource-projector.js";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "0190a0a0-0000-7000-8000-000000000001",
    name: "commit-msg",
    description: "Draft a commit message",
    body: "Run git status.",
    exposeAsPrompt: true,
    author: { setupOwnerId: "owner-1", displayName: "Owner" },
    updatedAt: new Date(0),
    publishedAt: null,
    ...overrides,
  };
}

// Hand-built store: a Map plus subscribe/notify, no Hub. Mutating methods notify
// so the projector re-projects, exactly as the real store's ingest does.
class FakeSkillStore implements SkillStoreI {
  private byId = new Map<string, Skill>();
  private readonly listeners = new Set<() => void>();
  private seq = 0;

  constructor(initial: Skill[] = []) {
    for (const skill of initial) this.byId.set(skill.id, skill);
  }

  applyPersonalSkills(payload: SetPersonalSkillsPayload): void {
    this.byId = new Map(payload.skills.map((s) => [s.id, s]));
    this.notify();
  }

  applyPublishedSkills(): void {}

  async publishSkill(id: string): Promise<Skill> {
    return this.setPublishedAt(id, new Date(0));
  }

  async unpublishSkill(id: string): Promise<Skill> {
    return this.setPublishedAt(id, null);
  }

  async createSkill(draft: SkillDraft): Promise<Skill> {
    const skill = makeSkill({ ...draft, id: `id-${++this.seq}` });
    this.byId.set(skill.id, skill);
    this.notify();
    return skill;
  }

  async updateSkill(id: string, draft: SkillDraft): Promise<Skill> {
    const skill = makeSkill({ ...draft, id });
    this.byId.set(id, skill);
    this.notify();
    return skill;
  }

  async deleteSkill(id: string): Promise<void> {
    this.byId.delete(id);
    this.notify();
  }

  getCatalog(): SkillCatalog {
    return { mine: [...this.byId.values()], others: [] };
  }

  getById(id: string): Skill | undefined {
    return this.byId.get(id);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setPublishedAt(id: string, publishedAt: Date | null): Skill {
    const existing = this.byId.get(id);
    if (!existing) throw new Error(`Skill ${id} not found`);
    const skill = { ...existing, publishedAt };
    this.byId.set(id, skill);
    this.notify();
    return skill;
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function activeResource(realUri: string): ActiveResource {
  return {
    serverName: SKILLS_SERVICE_NAME,
    capabilityName: realUri,
    definition: { uri: `skill://${SKILLS_SERVICE_NAME}/x/SKILL.md`, name: "x" },
    origin: "internal",
  };
}

function activePrompt(name: string): ActivePrompt {
  return {
    serverName: SKILLS_SERVICE_NAME,
    capabilityName: name,
    definition: { name },
    origin: "internal",
  };
}

function build(
  store: SkillStoreI,
  isSkillVisible: (
    consumer: ConsumerContext,
    skillId: string,
  ) => boolean = () => true,
) {
  const registry = new CapabilityRegistry(noOpLogger);
  const internal = new InternalCapabilitiesService(noOpLogger);
  const projector = new SkillResourceProjector(
    {
      skillStore: store,
      capabilityRegistry: registry,
      internalCapabilities: internal,
      isSkillVisible,
    },
    noOpLogger,
  );
  return { registry, internal, projector };
}

function projectedResourceCount(registry: CapabilityRegistry): number {
  return registry.servers.get(SKILLS_SERVICE_NAME)?.resources?.length ?? 0;
}

describe("skillToSkillMd", () => {
  it("renders yaml frontmatter then the body", () => {
    const md = skillToSkillMd(
      makeSkill({
        name: "commit-msg",
        description: "Draft it",
        body: "Run git status.",
      }),
    );
    expect(md).toBe(
      "---\nname: commit-msg\ndescription: Draft it\n---\n\nRun git status.\n",
    );
  });

  it("keeps a multi-line body intact", () => {
    const body = "Line one.\nLine two.";
    const md = skillToSkillMd(makeSkill({ body }));
    expect(md).toContain(`---\n\n${body}\n`);
  });
});

describe("skillUri / parseIdFromSkillUri", () => {
  it("round-trips a skill id", () => {
    const skill = makeSkill({ id: "0190a0a0-0000-7000-8000-000000000001" });
    expect(parseIdFromSkillUri(skillUri(skill))).toBe(skill.id);
  });

  it("returns undefined for a server-injected uri (id must be one segment)", () => {
    expect(
      parseIdFromSkillUri("skill://mcpx-skills/abc/SKILL.md"), // two segments in path = out of format
    ).toBeUndefined();
  });

  it("returns undefined for a non-skill uri", () => {
    expect(parseIdFromSkillUri("skill://abc/other.md")).toBeUndefined(); // no SKILL.md
    expect(parseIdFromSkillUri("http://abc/SKILL.md")).toBeUndefined(); // wrong scheme
  });
});

describe("SkillResourceProjector (resource face)", () => {
  it("registers a resources repository for the skills server", () => {
    const { internal, projector } = build(new FakeSkillStore());
    projector.initialize();
    expect(internal.hasHandler("resources", SKILLS_SERVICE_NAME)).toBe(true);
  });

  it("projects stored skills as resources on initialize", () => {
    const { registry, projector } = build(
      new FakeSkillStore([makeSkill({ id: "a" }), makeSkill({ id: "b" })]),
    );
    projector.initialize();
    expect(projectedResourceCount(registry)).toBe(2);
  });

  it("re-projects when the store changes", async () => {
    // The projector subscribes to the store, so when the store changes (create/delete), the registry is updated.
    const store = new FakeSkillStore([makeSkill({ id: "a" })]);
    const { registry, projector } = build(store);
    projector.initialize();
    expect(projectedResourceCount(registry)).toBe(1);

    const created = await store.createSkill(makeSkill({ name: "second" }));
    expect(projectedResourceCount(registry)).toBe(2);

    await store.deleteSkill(created.id);
    expect(projectedResourceCount(registry)).toBe(1);
  });

  it("the repository reads SKILL.md for a known skill and undefined otherwise", () => {
    const skill = makeSkill({ id: "a", body: "Do X." });
    const store = new FakeSkillStore([skill]);
    const { internal, projector } = build(store);
    projector.initialize();

    const hit = internal.dispatchResource(activeResource(skillUri(skill)), {});
    const content = hit?.contents[0];
    expect(content && "text" in content ? content.text : "").toContain("Do X.");

    const miss = internal.dispatchResource(
      activeResource(skillUri(makeSkill({ id: "unrelated-other-skill" }))),
      {},
    );
    expect(miss).toBeUndefined();
  });

  it("stops re-projecting after shutdown", async () => {
    const store = new FakeSkillStore([makeSkill({ id: "a" })]);
    const { registry, projector } = build(store);
    projector.initialize();
    projector.shutdown();
    // The store changes, but the projector is unsubscribed and does not re-project the changes.

    await store.createSkill(makeSkill({ name: "second" }));
    expect(projectedResourceCount(registry)).toBe(1);
  });
});

describe("SkillResourceProjector (prompt face)", () => {
  it("registers a prompts handler and projects only exposeAsPrompt skills", () => {
    const store = new FakeSkillStore([
      makeSkill({ id: "a", exposeAsPrompt: true }),
      makeSkill({ id: "b", name: "hidden", exposeAsPrompt: false }),
    ]);
    const { registry, internal, projector } = build(store);
    projector.initialize();

    expect(internal.hasHandler("prompts", SKILLS_SERVICE_NAME)).toBe(true);
    expect(registry.servers.get(SKILLS_SERVICE_NAME)?.prompts).toHaveLength(1);
  });

  it("getPrompt returns SKILL.md for an exposed skill, undefined for a hidden one", () => {
    const store = new FakeSkillStore([
      makeSkill({ name: "commit-msg", body: "Do X.", exposeAsPrompt: true }),
      makeSkill({ id: "b", name: "hidden", exposeAsPrompt: false }),
    ]);
    const { internal, projector } = build(store);
    projector.initialize();

    const result = internal.dispatchPrompt(activePrompt("commit-msg"), {});
    const message = result?.messages[0];
    const text = message?.content.type === "text" ? message.content.text : "";
    expect(text).toContain("Do X.");

    expect(internal.dispatchPrompt(activePrompt("hidden"), {})).toBeUndefined();
  });
});

describe("SkillResourceProjector (face visibility)", () => {
  const skill = makeSkill({ exposeAsPrompt: true });
  const visibleForDevsOnly = (
    consumer: ConsumerContext,
    skillId: string,
  ): boolean => consumer.consumerTag === "devs" && skillId === skill.id;

  it("resource face lists and reads only where the skill is visible", () => {
    const { internal, projector } = build(
      new FakeSkillStore([skill]),
      visibleForDevsOnly,
    );
    projector.initialize();

    const cap = activeResource(skillUri(skill));
    expect(
      internal.visibleResourceForListing(cap, { consumerTag: "devs" }),
    ).toBe(cap.definition);
    expect(
      internal.visibleResourceForListing(cap, { consumerTag: "ops" }),
    ).toBeUndefined();

    const read = internal.dispatchResource(cap, { consumerTag: "devs" });
    const content = read?.contents[0];
    expect(content && "text" in content ? content.text : "").toContain(
      skill.body,
    );
    expect(
      internal.dispatchResource(cap, { consumerTag: "ops" }),
    ).toBeUndefined();
  });

  it("prompt face lists and serves only where the skill is visible", () => {
    const { internal, projector } = build(
      new FakeSkillStore([skill]),
      visibleForDevsOnly,
    );
    projector.initialize();

    const cap = activePrompt(skill.name);
    expect(internal.visiblePromptForListing(cap, { consumerTag: "devs" })).toBe(
      cap.definition,
    );
    expect(
      internal.visiblePromptForListing(cap, { consumerTag: "ops" }),
    ).toBeUndefined();

    const served = internal.dispatchPrompt(cap, { consumerTag: "devs" });
    const message = served?.messages[0];
    const text = message?.content.type === "text" ? message.content.text : "";
    expect(text).toContain(skill.body);
    expect(
      internal.dispatchPrompt(cap, { consumerTag: "ops" }),
    ).toBeUndefined();
  });

  it("a uri that is not a skill uri is not visible", () => {
    const { internal, projector } = build(new FakeSkillStore([skill]));
    projector.initialize();

    expect(
      internal.visibleResourceForListing(
        activeResource("skill://mcpx-skills/x/SKILL.md"),
        {},
      ),
    ).toBeUndefined();
  });
});
