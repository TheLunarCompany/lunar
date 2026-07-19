import {
  skillCatalogResponseSchema,
  skillDraftSchema,
  updateSkillCapabilitiesRequestSchema,
  upsertSkillRequestSchema,
} from "./skill.js";

const skill = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "review-pull-requests",
  description: "Review repository changes with the local project rules.",
  body: "# Review pull requests\n\nCheck tests, risks, and regressions.",
  exposeAsPrompt: true,
  author: {
    setupOwnerId: "owner-1",
    displayName: "Amir",
  },
  updatedAt: "2026-06-29T10:00:00.000Z",
};

describe("skill API schemas", () => {
  it("accepts a catalog response with skills", () => {
    const result = skillCatalogResponseSchema.safeParse({ skills: [skill] });

    expect(result.success).toBe(true);
    expect(result.data?.skills).toHaveLength(1);
    expect(result.data?.skills[0]?.updatedAt).toEqual(
      new Date("2026-06-29T10:00:00.000Z"),
    );
  });

  it("accepts an upsert skill request draft", () => {
    const result = upsertSkillRequestSchema.safeParse({
      name: "review-pull-requests",
      description: "Review repository changes with the local project rules.",
      body: "# Review pull requests",
      exposeAsPrompt: false,
      capabilityGroup: {
        name: "Repository",
        items: [
          {
            catalogItemId: "0190a000-0000-7000-8000-000000000010",
            tools: ["pull_request_read"],
            prompts: [],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: "review-pull-requests",
      exposeAsPrompt: false,
      capabilityGroup: {
        name: "Repository",
        items: [
          {
            catalogItemId: "0190a000-0000-7000-8000-000000000010",
            tools: ["pull_request_read"],
            prompts: [],
          },
        ],
      },
    });
  });

  it("accepts an empty skill body", () => {
    const result = upsertSkillRequestSchema.safeParse({
      name: "empty-body",
      description: "Create a skill before writing instructions.",
      body: "",
      exposeAsPrompt: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.body).toBe("");
  });

  it("defaults exposeAsPrompt on skill drafts", () => {
    const result = skillDraftSchema.safeParse({
      name: "write-release-notes",
      description: "Summarize merged changes.",
      body: "# Write release notes",
    });

    expect(result.success).toBe(true);
    expect(result.data?.exposeAsPrompt).toBe(true);
  });

  it("accepts null to explicitly clear skill capabilities", () => {
    const result = updateSkillCapabilitiesRequestSchema.safeParse({
      capabilityGroup: null,
    });

    expect(result.success).toBe(true);
    expect(result.data?.capabilityGroup).toBeNull();
  });

  it("rejects invalid tool group payloads", () => {
    const result = upsertSkillRequestSchema.safeParse({
      name: "review-pull-requests",
      description: "Review repository changes with the local project rules.",
      body: "# Review pull requests",
      exposeAsPrompt: true,
      capabilityGroup: {
        name: "Repository",
        items: [
          {
            catalogItemId: "0190a000-0000-7000-8000-000000000010",
            tools: [42],
            prompts: [],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty names and descriptions", () => {
    expect(
      upsertSkillRequestSchema.safeParse({
        name: "",
        description: "Describe the skill.",
        body: "# Body",
        exposeAsPrompt: true,
      }).success,
    ).toBe(false);
    expect(
      upsertSkillRequestSchema.safeParse({
        name: "valid-skill",
        description: "",
        body: "# Body",
        exposeAsPrompt: true,
      }).success,
    ).toBe(false);
  });

  it("rejects non-slug skill names", () => {
    for (const name of [
      "Review pull requests",
      "review_prs",
      "Review",
      "-review-prs",
      "review-prs-",
      "review--prs",
    ]) {
      expect(
        upsertSkillRequestSchema.safeParse({
          name,
          description: "Describe the skill.",
          body: "# Body",
          exposeAsPrompt: true,
        }).success,
      ).toBe(false);
    }
  });
});
