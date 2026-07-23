import { Skill } from "@mcpx/shared-model";
import { resetEnv } from "../src/env.js";
import {
  calculatorTargetServer,
  echoCatalogItem,
  echoTargetServer,
  getTestHarness,
  TestHarness,
} from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

const ENABLED_TAG = "skill-consumer";
const OTHER_TAG = "other-consumer";

// Its capability group selects the echo item only, so the calculator stays out
// of scope once the skill is enabled for a consumer.
const SKILL: Skill = {
  id: "0190b000-0000-7000-8000-000000000001",
  name: "commit-msg",
  description: "Draft a commit message from the staged changes and commit",
  body: [
    "Run `git status` and `git diff --staged` to see what changed.",
    "Summarize the change into one short subject line, imperative mood, under 50 chars.",
    'Then run `git commit -m "<subject>"`.',
  ].join("\n"),
  exposeAsPrompt: true,
  author: { setupOwnerId: "owner-1", displayName: "Owner" },
  updatedAt: new Date("2026-07-01T10:00:00.000Z"),
  publishedAt: null,
  capabilityGroup: {
    items: [{ catalogItemId: echoCatalogItem.id, tools: "*", prompts: [] }],
  },
};

const SKILL_URI = `skill://mcpx-skills/${SKILL.id}/SKILL.md`;

// Target servers carry their catalog item id, the identity space the
// capability group is keyed by.
const targetServers = [
  { ...echoTargetServer, catalogItemId: echoCatalogItem.id },
  calculatorTargetServer,
];

function buildHarness(consumerTag: string): TestHarness {
  return getTestHarness({
    targetServers,
    clientConnectExtraHeaders: { "x-lunar-consumer-tag": consumerTag },
  });
}

// Enable a skill for a consumer tag through the REST route, same as the admin UI.
async function enableSkillViaRoute(props: {
  skillId: string;
  consumerTag: string;
}): Promise<void> {
  const { skillId, consumerTag } = props;
  const response = await fetch(
    `${MCPX_BASE_URL}/skills/${skillId}/enabled/consumerTag/${encodeURIComponent(consumerTag)}`,
    { method: "PUT" },
  );
  if (response.status !== 204) {
    throw new Error(`enableSkill failed: ${response.status}`);
  }
}

// Scoping mode only needs ENABLE_SKILL_SCOPING: the kind flags govern
// upstream prompts/resources and play no part in serving skill faces.
describe("Skill serving under scoping over StreamableHTTP", () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env = { ...originalEnv };
    process.env["ENABLE_SKILL_SCOPING"] = "true";
    resetEnv();
  });

  afterAll(() => {
    process.env = { ...originalEnv };
    resetEnv();
  });

  describe("a consumer whose skill is enabled mid-session", () => {
    let harness: TestHarness;

    // Arrange: skill is in the store but not enabled for anyone yet.
    beforeAll(async () => {
      harness = buildHarness(ENABLED_TAG);
      await harness.initialize("StreamableHTTP");
      harness.services.skills.store.applyPersonalSkills({ skills: [SKILL] });
    }, 15_000);

    afterAll(async () => {
      await harness.shutdown();
    });

    describe("before the skill is enabled", () => {
      it("serves all tools unrestricted", async () => {
        const { tools } = await harness.client.listTools();
        expect(tools.map((t) => t.name)).toEqual([
          "calculator-service__add",
          "calculator-service__powerOfTwo",
          "echo-service__echo",
        ]);
      });

      it("shows no skill faces", async () => {
        const { resources } = await harness.client.listResources();
        expect(resources).toEqual([]);

        const { prompts } = await harness.client.listPrompts();
        expect(prompts).toEqual([]);
      });
    });

    describe("after enabling the skill via the route", () => {
      // Act: enable from outside, exactly as the admin UI would.
      beforeAll(async () => {
        await enableSkillViaRoute({
          skillId: SKILL.id,
          consumerTag: ENABLED_TAG,
        });
      });

      it("lists only the tools of the skill's capability group", async () => {
        const { tools } = await harness.client.listTools();
        expect(tools.map((t) => t.name)).toEqual(["echo-service__echo"]);
      });

      it("rejects calling a tool outside the capability group", async () => {
        await expect(
          harness.client.callTool({
            name: "calculator-service__add",
            arguments: { a: 1, b: 2 },
          }),
        ).rejects.toThrow(/permission denied/i);
      });

      it("lists the skill as a resource with a server-injected uri", async () => {
        const { resources } = await harness.client.listResources();
        const skill = resources.find((r) => r.name === SKILL.name);
        expect(skill?.uri).toBe(SKILL_URI);
      });

      it("reads the skill content and audits resource_read with the un-injected uri", async () => {
        const result = await harness.client.readResource({ uri: SKILL_URI });

        const content = result.contents[0];
        expect(content?.mimeType).toBe("text/markdown");
        expect(content && "text" in content ? content.text : "").toContain(
          SKILL.body,
        );

        const event = await latestAuditEvent("resource_read");
        expect(event?.payload).toEqual({
          resourceUri: `skill://${SKILL.id}/SKILL.md`,
          targetServerName: "mcpx-skills",
          consumerTag: ENABLED_TAG,
        });
      });

      it("lists the skill as a bare-name prompt and gets its content with audit", async () => {
        const { prompts } = await harness.client.listPrompts();
        const prompt = prompts.find((p) => p.name === SKILL.name);
        expect(prompt).toBeDefined();

        const result = await harness.client.getPrompt({ name: SKILL.name });
        const message = result.messages[0];
        expect(message?.role).toBe("user");
        const text =
          message && message.content.type === "text"
            ? message.content.text
            : "";
        expect(text).toContain(SKILL.body);

        const event = await latestAuditEvent("prompt_used");
        expect(event?.payload).toMatchObject({
          promptName: SKILL.name,
          targetServerName: "mcpx-skills",
          consumerTag: ENABLED_TAG,
        });
      });

      it("enabling a second, group-less skill adds its faces without widening the tool scope", async () => {
        const created = await harness.services.skills.store.createSkill({
          name: "another-skill",
          description: "A group-less skill",
          body: "Do the other thing.",
          exposeAsPrompt: true,
        });
        const createdUri = `skill://mcpx-skills/${created.id}/SKILL.md`;

        const before = await harness.client.listResources();
        expect(
          before.resources.find((r) => r.uri === createdUri),
        ).toBeUndefined();

        await enableSkillViaRoute({
          skillId: created.id,
          consumerTag: ENABLED_TAG,
        });

        const after = await harness.client.listResources();
        expect(after.resources.find((r) => r.uri === createdUri)).toBeDefined();

        // Group-less: capability-neutral, the tool scope must not widen.
        const { tools } = await harness.client.listTools();
        expect(tools.map((t) => t.name)).toEqual(["echo-service__echo"]);
      });
    });

    // The handler logs synchronously before responding, so by the time the
    // client call resolves the event is already in the audit buffer. read()
    // drains newest-first, so limit 1 returns this test's event without
    // waiting on the (1s minimum) disk flush.
    async function latestAuditEvent(
      eventType: "resource_read" | "prompt_used",
    ) {
      const [event] = await harness.services.auditLog.read({
        eventTypes: new Set([eventType]),
        limit: 1,
      });
      return event;
    }
  });

  // The full author flow from the outside: create over REST (mock hub mints the
  // skill), draft over REST, observe what agents get over MCP. Each test
  // arranges its own skill; nothing leans on a previous test's state.
  describe("draft overlay on serving", () => {
    const originalSavedBody = "Saved instructions: run `git status` first.";
    const overlay = {
      description: "Drafted: draft a commit message",
      body: "Drafted instructions: just run `git commit`.", // Different from `originalSavedBody`!
      exposeAsPrompt: true,
    };
    let harness: TestHarness;

    beforeAll(async () => {
      harness = buildHarness(ENABLED_TAG);
      await harness.initialize("StreamableHTTP");
    }, 15_000);

    afterAll(async () => {
      await harness.shutdown();
    });

    // Skill names are per-test: the name is the prompt's identity, so tests
    // sharing one would collide in the registry.
    async function createEnabledSkill(name: string): Promise<Skill> {
      const response = await fetch(`${MCPX_BASE_URL}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: "A skill to draft on.",
          body: originalSavedBody,
          exposeAsPrompt: true,
        }),
      });
      expect(response.status).toBe(201);
      const skill: Skill = await response.json();
      await enableSkillViaRoute({
        skillId: skill.id,
        consumerTag: ENABLED_TAG,
      });
      return skill;
    }

    async function saveDraft(skill: Skill): Promise<void> {
      const response = await fetch(
        `${MCPX_BASE_URL}/skills/${skill.id}/draft`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft: overlay,
            baseUpdatedAt: skill.updatedAt,
          }),
        },
      );
      expect(response.status).toBe(200);
    }

    async function readSkillText(skill: Skill): Promise<string> {
      const result = await harness.client.readResource({
        uri: `skill://mcpx-skills/${skill.id}/SKILL.md`,
      });
      const content = result.contents[0];
      return content && "text" in content ? String(content.text) : "";
    }

    it("serves the saved content while no draft exists", async () => {
      const skill = await createEnabledSkill("draft-serving-none");

      await expect(readSkillText(skill)).resolves.toContain(originalSavedBody);
    });

    it("serves the drafted content once a draft is saved", async () => {
      const skill = await createEnabledSkill("draft-serving-drafted");

      await saveDraft(skill);

      const text = await readSkillText(skill);
      expect(text).not.toContain(originalSavedBody);
      expect(text).toContain(overlay.body);

      const prompt = await harness.client.getPrompt({ name: skill.name });
      const message = prompt.messages[0];
      const promptText =
        message && message.content.type === "text" ? message.content.text : "";
      expect(promptText).not.toContain(originalSavedBody);
      expect(promptText).toContain(overlay.body);
    });

    it("serves the saved content again after the draft is discarded", async () => {
      const skill = await createEnabledSkill("draft-serving-discarded");
      await saveDraft(skill);

      const response = await fetch(
        `${MCPX_BASE_URL}/skills/${skill.id}/draft`,
        { method: "DELETE" },
      );
      expect(response.status).toBe(200);

      const text = await readSkillText(skill);
      expect(text).toContain(originalSavedBody);
      expect(text).not.toContain(overlay.body);
    });
  });

  describe("consumer with nothing enabled", () => {
    let harness: TestHarness;

    beforeAll(async () => {
      harness = buildHarness(OTHER_TAG);
      await harness.initialize("StreamableHTTP");
      harness.services.skills.store.applyPersonalSkills({ skills: [SKILL] });
    }, 15_000);

    afterAll(async () => {
      await harness.shutdown();
    });

    it("lists all tools, unrestricted", async () => {
      const { tools } = await harness.client.listTools();
      expect(tools.map((t) => t.name)).toEqual([
        "calculator-service__add",
        "calculator-service__powerOfTwo",
        "echo-service__echo",
      ]);
    });

    it("sees no skill faces", async () => {
      const { resources } = await harness.client.listResources();
      expect(resources).toEqual([]);

      const { prompts } = await harness.client.listPrompts();
      expect(prompts).toEqual([]);
    });

    it("cannot read the skill resource nor get its prompt", async () => {
      await expect(
        harness.client.readResource({ uri: SKILL_URI }),
      ).rejects.toThrow(/not available/i);

      await expect(
        harness.client.getPrompt({ name: SKILL.name }),
      ).rejects.toThrow(/not available/i);
    });
  });
});
