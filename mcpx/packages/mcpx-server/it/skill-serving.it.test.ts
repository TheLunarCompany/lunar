import { resetEnv } from "../src/env.js";
import { getTestHarness } from "./utils.js";

const CONSUMER_TAG = "skill-consumer";

// A skill seeded into the store after startup; the projector reacts and serves
// it as a skill:// Resource and a bare-name /slash Prompt.
const DRAFT = {
  name: "commit-msg",
  description: "Draft a commit message from the staged changes and commit",
  body: [
    "Run `git status` and `git diff --staged` to see what changed.",
    "Summarize the change into one short subject line, imperative mood, under 50 chars.",
    'Then run `git commit -m "<subject>"`.',
  ].join("\n"),
  exposeAsPrompt: true,
};

describe("Skill serving over StreamableHTTP", () => {
  let harness: ReturnType<typeof getTestHarness>;
  let skillId: string;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env = { ...originalEnv };
    process.env["ENABLE_RESOURCE_CAPABILITY"] = "true";
    process.env["ENABLE_PROMPT_CAPABILITY"] = "true";
    resetEnv();
    harness = getTestHarness({
      clientConnectExtraHeaders: { "x-lunar-consumer-tag": CONSUMER_TAG },
    });
    await harness.initialize("StreamableHTTP");
    const skill = await harness.services.skillStore.createSkill(DRAFT);
    skillId = skill.id;
  });

  afterAll(async () => {
    process.env = { ...originalEnv };
    resetEnv();
    await harness.shutdown();
  });

  it("lists the seeded skill as a resource with a server-injected uri", async () => {
    const { resources } = await harness.client.listResources();
    const skill = resources.find((r) => r.name === DRAFT.name);
    expect(skill).toBeDefined();
    expect(skill?.uri).toBe(`skill://mcpx-skills/${skillId}/SKILL.md`);
  });

  it("reads the skill content and audits resource_read with the un-injected uri", async () => {
    const uri = `skill://mcpx-skills/${skillId}/SKILL.md`;
    const result = await harness.client.readResource({ uri });

    const content = result.contents[0];
    expect(content?.mimeType).toBe("text/markdown");
    expect(content && "text" in content ? content.text : "").toContain(
      DRAFT.body,
    );

    const event = await latestAuditEvent("resource_read");
    expect(event?.payload).toEqual({
      resourceUri: `skill://${skillId}/SKILL.md`,
      targetServerName: "mcpx-skills",
      consumerTag: CONSUMER_TAG,
    });
  });

  it("lists the skill as a bare-name prompt and gets its content with audit", async () => {
    const { prompts } = await harness.client.listPrompts();
    const prompt = prompts.find((p) => p.name === DRAFT.name);
    expect(prompt).toBeDefined();

    const result = await harness.client.getPrompt({ name: DRAFT.name });
    const message = result.messages[0];
    expect(message?.role).toBe("user");
    const text =
      message && message.content.type === "text" ? message.content.text : "";
    expect(text).toContain(DRAFT.body);

    const event = await latestAuditEvent("prompt_used");
    expect(event?.payload).toMatchObject({
      promptName: DRAFT.name,
      targetServerName: "mcpx-skills",
      consumerTag: CONSUMER_TAG,
    });
  });

  it("reflects a store update in the resource list", async () => {
    // Its own skill so the shared seed stays untouched across tests.
    const created = await harness.services.skillStore.createSkill({
      ...DRAFT,
      name: "another-skill",
    });
    await harness.services.skillStore.updateSkill(created.id, {
      ...DRAFT,
      name: "another-skill",
      description: "Updated description",
    });

    const { resources } = await harness.client.listResources();
    const skill = resources.find(
      (r) => r.uri === `skill://mcpx-skills/${created.id}/SKILL.md`,
    );
    expect(skill?.description).toBe("Updated description");
  });

  // The handler logs synchronously before responding, so by the time the client
  // call resolves the event is already in the audit buffer. read() drains the
  // buffer newest-first, so limit 1 returns this test's event without waiting on
  // the (1s minimum) disk flush.
  async function latestAuditEvent(eventType: "resource_read" | "prompt_used") {
    const [event] = await harness.services.auditLog.read({
      eventTypes: new Set([eventType]),
      limit: 1,
    });
    return event;
  }
});
