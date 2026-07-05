import { Skill } from "@mcpx/shared-model";
import { getTestHarness, TestHarness } from "./utils.js";

const MCPX_PORT = 19000;
const MCPX_BASE_URL = `http://localhost:${MCPX_PORT}`;
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
};

describe("Skills endpoints", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = getTestHarness({ targetServers: [], mcpxPort: MCPX_PORT });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  beforeEach(() => {
    harness.services.skillStore.applyPersonalSkills({ skills: [seedSkill] });
  });

  it("returns personal skills", async () => {
    const response = await fetch(`${MCPX_BASE_URL}/skills`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      skills: [{ id: seedSkill.id, name: "review-pull-requests" }],
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

    const created = harness.services.skillStore.getById(body.id);
    expect(created).toMatchObject({ id: body.id, name: "write-release-notes" });
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
    expect(harness.services.skillStore.getById(created.id)).toBeUndefined();
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
    expect(harness.services.skillStore.getById(created.id)).toMatchObject({
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

  async function createSkill(): Promise<Skill> {
    const response = await fetch(`${MCPX_BASE_URL}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "temporary-skill",
        description: "Temporary skill for route testing.",
        body: "# Temporary skill",
        exposeAsPrompt: true,
      }),
    });
    expect(response.status).toBe(201);
    return (await response.json()) as Skill;
  }
});
