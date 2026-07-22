import { Skill, SkillCatalogResponse } from "@mcpx/shared-model";
import { withAsyncPolling } from "@mcpx/toolkit-core/time";
import { getTestHarness, TestHarness } from "./utils.js";

const MCPX_PORT = 19000;
const MCPX_BASE_URL = `http://localhost:${MCPX_PORT}`;
const HUB_PORT = 19001;
const seedSkill: Skill = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "review-pull-requests",
  description: "Review repository changes with the local project rules.",
  body: "# Review pull requests\n\nCheck tests, risks, and regressions.",
  exposeAsPrompt: true,
  author: {
    setupOwnerId: "owner-1",
    displayName: "Amir",
  },
  updatedAt: new Date("2026-06-29T10:00:00.000Z"),
  publishedAt: null,
};
const catalogItemId = "0190a000-0000-7000-8000-000000000010";

describe("Skills endpoints", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = getTestHarness({
      targetServers: [],
      mcpxPort: MCPX_PORT,
      hubPort: HUB_PORT,
    });
    await harness.initialize("StreamableHTTP");
    harness.services.skills.store.applyPersonalSkills({ skills: [seedSkill] });
  }, 15_000);

  afterEach(async () => {
    await harness.shutdown();
  });

  it("returns personal skills", async () => {
    const response = await fetch(`${MCPX_BASE_URL}/skills`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mine: [{ id: seedSkill.id, name: "review-pull-requests" }],
      others: [],
    });
  });

  it("returns one personal skill by id", async () => {
    const response = await fetch(`${MCPX_BASE_URL}/skills/${seedSkill.id}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: seedSkill.id,
      name: "review-pull-requests",
    });
  });

  it("returns 404 when a personal skill is missing", async () => {
    const response = await fetch(
      `${MCPX_BASE_URL}/skills/0190a000-0000-7000-8000-000000000099`,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      message: "Skill not found",
    });
  });

  it("creates a skill from a valid draft", async () => {
    const response = await fetch(`${MCPX_BASE_URL}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "write-release-notes",
        description: "Summarize merged changes.",
        body: "# Write release notes",
        exposeAsPrompt: true,
      }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({
      name: "write-release-notes",
      description: "Summarize merged changes.",
      body: "# Write release notes",
      exposeAsPrompt: true,
    });

    const created = harness.services.skills.store.getById(body.id);
    expect(created).toMatchObject({ id: body.id, name: "write-release-notes" });
  });

  it("creates a skill with an empty body", async () => {
    const response = await fetch(`${MCPX_BASE_URL}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "empty-body",
        description: "Create a skill before writing instructions.",
        body: "",
        exposeAsPrompt: true,
      }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({
      name: "empty-body",
      description: "Create a skill before writing instructions.",
      body: "",
      exposeAsPrompt: true,
    });
  });

  it("rejects invalid create requests", async () => {
    const response = await fetch(`${MCPX_BASE_URL}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "write-release-notes",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid request schema",
    });
  });

  it("hard deletes an existing personal skill", async () => {
    const created = await createSkill();

    const response = await fetch(`${MCPX_BASE_URL}/skills/${created.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);
    expect(harness.services.skills.store.getById(created.id)).toBeUndefined();
  });

  it("returns 404 when deleting a missing personal skill", async () => {
    const response = await fetch(
      `${MCPX_BASE_URL}/skills/0190a000-0000-7000-8000-000000000099`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(404);
  });

  it("updates an existing personal skill", async () => {
    const created = await createSkill();

    const response = await fetch(`${MCPX_BASE_URL}/skills/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "review-pull-requests-v2",
        description: "Updated description.",
        body: "# Review pull requests v2",
        exposeAsPrompt: true,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: created.id,
      name: "review-pull-requests-v2",
    });
    expect(harness.services.skills.store.getById(created.id)).toMatchObject({
      name: "review-pull-requests-v2",
    });
  });

  it("returns 404 when updating a missing personal skill", async () => {
    const response = await fetch(
      `${MCPX_BASE_URL}/skills/0190a000-0000-7000-8000-000000000099`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "missing-skill",
          description: "Updated description.",
          body: "# Missing skill",
          exposeAsPrompt: true,
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("rejects invalid update requests", async () => {
    const response = await fetch(`${MCPX_BASE_URL}/skills/${seedSkill.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "only-name" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid request schema",
    });
  });

  it("updates only details while preserving existing capabilities", async () => {
    const created = await createSkill({
      capabilityGroup: {
        name: "Legacy name",
        items: [
          {
            catalogItemId,
            tools: ["get_pull_request"],
            prompts: ["review_diff"],
          },
        ],
      },
    });

    const response = await fetch(
      `${MCPX_BASE_URL}/skills/${created.id}/details`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "temporary-skill-updated",
          description: "Updated details without touching capabilities.",
          body: "# Temporary skill updated",
          exposeAsPrompt: false,
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: created.id,
      name: "temporary-skill-updated",
      description: "Updated details without touching capabilities.",
      body: "# Temporary skill updated",
      exposeAsPrompt: false,
      capabilityGroup: {
        name: "Legacy name",
        items: [
          {
            catalogItemId,
            tools: ["get_pull_request"],
            prompts: ["review_diff"],
          },
        ],
      },
    });
    expect(harness.services.skills.store.getById(created.id)).toMatchObject({
      name: "temporary-skill-updated",
      capabilityGroup: created.capabilityGroup,
    });
  });

  it("returns 404 when updating details for a missing skill", async () => {
    const response = await fetch(
      `${MCPX_BASE_URL}/skills/0190a000-0000-7000-8000-000000000099/details`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "missing-skill",
          description: "Updated description.",
          body: "# Missing skill",
          exposeAsPrompt: true,
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("updates only capabilities for an existing personal skill", async () => {
    const created = await createSkill();

    const response = await fetch(
      `${MCPX_BASE_URL}/skills/${created.id}/capabilities`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capabilityGroup: {
            name: "Ignored legacy name",
            items: [
              {
                catalogItemId,
                tools: ["get_pull_request"],
                prompts: ["review_diff"],
              },
            ],
          },
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: created.id,
      name: created.name,
      description: created.description,
      body: created.body,
      exposeAsPrompt: created.exposeAsPrompt,
      capabilityGroup: {
        items: [
          {
            catalogItemId,
            tools: ["get_pull_request"],
            prompts: ["review_diff"],
          },
        ],
      },
    });
    expect(
      harness.services.skills.store.getById(created.id)?.capabilityGroup,
    ).toEqual({
      items: [
        {
          catalogItemId,
          tools: ["get_pull_request"],
          prompts: ["review_diff"],
        },
      ],
    });
  });

  it("removes capabilities when capability items are empty", async () => {
    const created = await createSkill({
      capabilityGroup: {
        name: "Legacy name",
        items: [
          {
            catalogItemId,
            tools: ["get_pull_request"],
            prompts: [],
          },
        ],
      },
    });

    const response = await fetch(
      `${MCPX_BASE_URL}/skills/${created.id}/capabilities`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilityGroup: { items: [] } }),
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Skill;
    expect(body.capabilityGroup).toBeUndefined();
    expect(
      harness.services.skills.store.getById(created.id)?.capabilityGroup,
    ).toBeUndefined();
  });

  it("preserves capabilities when capabilityGroup is omitted", async () => {
    const created = await createSkill({
      capabilityGroup: {
        name: "Legacy name",
        items: [
          {
            catalogItemId,
            tools: ["get_pull_request"],
            prompts: [],
          },
        ],
      },
    });

    const response = await fetch(
      `${MCPX_BASE_URL}/skills/${created.id}/capabilities`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      capabilityGroup: created.capabilityGroup,
    });
    expect(
      harness.services.skills.store.getById(created.id)?.capabilityGroup,
    ).toEqual(created.capabilityGroup);
  });

  it("removes capabilities when capabilityGroup is null", async () => {
    const created = await createSkill({
      capabilityGroup: {
        name: "Legacy name",
        items: [
          {
            catalogItemId,
            tools: ["get_pull_request"],
            prompts: [],
          },
        ],
      },
    });

    const response = await fetch(
      `${MCPX_BASE_URL}/skills/${created.id}/capabilities`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilityGroup: null }),
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Skill;
    expect(body.capabilityGroup).toBeUndefined();
    expect(
      harness.services.skills.store.getById(created.id)?.capabilityGroup,
    ).toBeUndefined();
  });

  it("returns 404 when updating capabilities for a missing skill", async () => {
    const response = await fetch(
      `${MCPX_BASE_URL}/skills/0190a000-0000-7000-8000-000000000099/capabilities`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilityGroup: { items: [] } }),
      },
    );

    expect(response.status).toBe(404);
  });

  describe("publish lifecycle", () => {
    // The seed skill is injected straight into the store, so the mock hub does
    // not know it; publish round-trips go through a REST-created skill.
    async function createSkill(): Promise<Skill> {
      const response = await fetch(`${MCPX_BASE_URL}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "publish-me",
          description: "A skill to publish.",
          body: "# Publish me",
          exposeAsPrompt: true,
        }),
      });
      expect(response.status).toBe(201);
      return response.json();
    }

    function publishSkill(id: string): Promise<Response> {
      return fetch(`${MCPX_BASE_URL}/skills/${id}/published`, {
        method: "PUT",
      });
    }

    function unpublishSkill(id: string): Promise<Response> {
      return fetch(`${MCPX_BASE_URL}/skills/${id}/published`, {
        method: "DELETE",
      });
    }

    async function getSkill(id: string): Promise<Skill> {
      const response = await fetch(`${MCPX_BASE_URL}/skills/${id}`);
      expect(response.status).toBe(200);
      return response.json();
    }

    it("publishes a skill and returns the stamped record", async () => {
      const created = await createSkill();

      const response = await publishSkill(created.id);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.publishedAt).not.toBeNull();
      await expect(getSkill(created.id)).resolves.toMatchObject({
        publishedAt: body.publishedAt,
      });
    });

    it("unpublishes a published skill", async () => {
      const created = await createSkill();
      await publishSkill(created.id);

      const response = await unpublishSkill(created.id);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.publishedAt).toBeNull();
      await expect(getSkill(created.id)).resolves.toMatchObject({
        publishedAt: null,
      });
    });

    it("returns 404 when publishing an unknown skill", async () => {
      const response = await publishSkill(
        "0190a000-0000-7000-8000-000000000099",
      );

      expect(response.status).toBe(404);
    });

    it("splits the org stream into mine | others by author", async () => {
      // Publish an own skill so the org stream carries it alongside the other
      // owner's — the own entry must land in mine only, never in others.
      const created = await createSkill();
      await publishSkill(created.id);
      const ownPublished = await getSkill(created.id);
      const otherSkill: Skill = {
        ...seedSkill,
        id: "0190a000-0000-7000-8000-000000000042",
        name: "borrowed-wisdom",
        author: { setupOwnerId: "owner-2", displayName: "Bea" },
        publishedAt: new Date("2026-07-01T08:00:00.000Z"),
      };

      harness.mockHubServer.emitPublishedSkillsToAll([
        ownPublished,
        otherSkill,
      ]);
      // The push travels the socket asynchronously; poll the catalog until it lands.
      const catalog = await withAsyncPolling({
        maxAttempts: 50,
        sleepTimeMs: 10,
        getValue: async (): Promise<SkillCatalogResponse> => {
          const response = await fetch(`${MCPX_BASE_URL}/skills`);
          return response.json();
        },
        found: (body): body is SkillCatalogResponse => body.others.length > 0,
      });

      expect(catalog.others).toMatchObject([
        { id: otherSkill.id, name: "borrowed-wisdom" },
      ]);
      expect(catalog.mine.map((s) => s.id).sort()).toEqual(
        [seedSkill.id, ownPublished.id].sort(),
      );
    });
  });

  describe("skill enablement", () => {
    it("enables a skill for a subject and lists it", async () => {
      const put = await fetch(enablementUrl(seedSkill.id, "devs"), {
        method: "PUT",
      });
      expect(put.status).toBe(204);

      const list = await fetch(`${MCPX_BASE_URL}/skills/enabled`);
      expect(list.status).toBe(200);
      await expect(list.json()).resolves.toEqual({
        enabled: [
          {
            subject: { kind: "consumerTag", value: "devs" },
            skillIds: [seedSkill.id],
          },
        ],
      });
    });

    it("enable is idempotent", async () => {
      await fetch(enablementUrl(seedSkill.id, "devs"), { method: "PUT" });
      const second = await fetch(enablementUrl(seedSkill.id, "devs"), {
        method: "PUT",
      });
      expect(second.status).toBe(204);

      const { enabled } = await (
        await fetch(`${MCPX_BASE_URL}/skills/enabled`)
      ).json();
      expect(enabled).toEqual([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [seedSkill.id],
        },
      ]);
    });

    it("accumulates enabled skills per subject", async () => {
      const created = await createSkill();
      await fetch(enablementUrl(seedSkill.id, "devs"), { method: "PUT" });
      await fetch(enablementUrl(created.id, "devs"), { method: "PUT" });

      const { enabled } = await (
        await fetch(`${MCPX_BASE_URL}/skills/enabled`)
      ).json();
      expect(enabled).toEqual([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [seedSkill.id, created.id],
        },
      ]);
    });

    it("disabling removes the skill; removing the last drops the row", async () => {
      const created = await createSkill();
      await fetch(enablementUrl(seedSkill.id, "devs"), { method: "PUT" });
      await fetch(enablementUrl(created.id, "devs"), { method: "PUT" });

      const first = await fetch(enablementUrl(created.id, "devs"), {
        method: "DELETE",
      });
      expect(first.status).toBe(204);
      const afterFirst = await (
        await fetch(`${MCPX_BASE_URL}/skills/enabled`)
      ).json();
      expect(afterFirst.enabled).toEqual([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [seedSkill.id],
        },
      ]);

      const last = await fetch(enablementUrl(seedSkill.id, "devs"), {
        method: "DELETE",
      });
      expect(last.status).toBe(204);
      const afterLast = await (
        await fetch(`${MCPX_BASE_URL}/skills/enabled`)
      ).json();
      expect(afterLast.enabled).toEqual([]);
    });

    it("returns 404 when enabling a missing skill", async () => {
      const response = await fetch(
        enablementUrl("0190a000-0000-7000-8000-000000000099", "devs"),
        { method: "PUT" },
      );
      expect(response.status).toBe(404);
    });

    it("rejects a subject kind outside the union", async () => {
      const response = await fetch(
        `${MCPX_BASE_URL}/skills/${seedSkill.id}/enabled/team/devs`,
        { method: "PUT" },
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        message: "Invalid subject",
      });
    });

    it("disable cleans a row whose skill was deleted", async () => {
      const created = await createSkill();
      await fetch(enablementUrl(created.id, "devs"), { method: "PUT" });
      await fetch(`${MCPX_BASE_URL}/skills/${created.id}`, {
        method: "DELETE",
      });

      const response = await fetch(enablementUrl(created.id, "devs"), {
        method: "DELETE",
      });
      expect(response.status).toBe(204);
      const { enabled } = await (
        await fetch(`${MCPX_BASE_URL}/skills/enabled`)
      ).json();
      expect(enabled).toEqual([]);
    });

    it("decodes an encoded subject value", async () => {
      const response = await fetch(
        enablementUrl(seedSkill.id, "my agent", "clientName"),
        { method: "PUT" },
      );
      expect(response.status).toBe(204);

      const { enabled } = await (
        await fetch(`${MCPX_BASE_URL}/skills/enabled`)
      ).json();
      expect(enabled).toEqual([
        {
          subject: { kind: "clientName", value: "my agent" },
          skillIds: [seedSkill.id],
        },
      ]);
    });
  });

  function enablementUrl(
    skillId: string,
    value: string,
    kind: "consumerTag" | "clientName" = "consumerTag",
  ): string {
    return `${MCPX_BASE_URL}/skills/${skillId}/enabled/${kind}/${encodeURIComponent(value)}`;
  }

  async function createSkill(overrides: Partial<Skill> = {}): Promise<Skill> {
    const response = await fetch(`${MCPX_BASE_URL}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "temporary-skill",
        description: "Temporary skill for route testing.",
        body: "# Temporary skill",
        exposeAsPrompt: true,
        ...overrides,
      }),
    });
    expect(response.status).toBe(201);
    return (await response.json()) as Skill;
  }
});
