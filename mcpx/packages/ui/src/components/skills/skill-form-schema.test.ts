import type { SkillDraft } from "@mcpx/shared-model";
import { describe, expect, it } from "vitest";
import {
  draftToFormValues,
  formValuesToDraft,
  skillFormSchema,
} from "./skill-form-schema";

const toolGroup = {
  name: "Repo",
  items: [
    {
      catalogItemId: "0190a000-0000-7000-8000-000000000010",
      tools: "*" as const,
      prompts: [],
    },
  ],
};

const validValues = {
  name: "review-prs",
  description:
    "Reviews pull requests and explains when changes need follow-up.",
  body: "# Review PRs",
  exposeAsPrompt: true,
  toolGroupJson: "",
};

describe("skillFormSchema", () => {
  it("accepts a lowercase hyphenated name and non-empty description", () => {
    expect(skillFormSchema.safeParse(validValues).success).toBe(true);
  });

  it("rejects names longer than 64 characters", () => {
    const result = skillFormSchema.safeParse({
      ...validValues,
      name: "a".repeat(65),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Name must be 64 characters or fewer.",
    );
  });

  it("rejects names with uppercase letters, spaces, underscores, or edge hyphens", () => {
    for (const name of [
      "Review",
      "review prs",
      "review_prs",
      "-review-prs",
      "review-prs-",
      "review--prs",
    ]) {
      const result = skillFormSchema.safeParse({
        ...validValues,
        name,
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "Name must use lowercase letters, numbers, and hyphens only, and must not start or end with a hyphen or contain consecutive hyphens. Examples: pdf-processing, data-analysis, code-review.",
      );
    }
  });

  it("rejects descriptions longer than 1024 characters", () => {
    const result = skillFormSchema.safeParse({
      ...validValues,
      description: "a".repeat(1025),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Description must be 1024 characters or fewer.",
    );
  });
});

describe("formValuesToDraft", () => {
  it("trims name/description/body, sets exposeAsPrompt:true, omits capabilityGroup when toolGroupJson is empty", () => {
    const draft = formValuesToDraft({
      name: "  My skill  ",
      description: "  Does a thing  ",
      body: "  # Body  ",
      exposeAsPrompt: true,
      toolGroupJson: "",
    });
    expect(draft.name).toBe("My skill");
    expect(draft.description).toBe("Does a thing");
    expect(draft.body).toBe("# Body");
    expect(draft.exposeAsPrompt).toBe(true);
    expect(draft.capabilityGroup).toBeUndefined();
  });

  it("preserves exposeAsPrompt:false from form values", () => {
    const draft = formValuesToDraft({
      name: "my-skill",
      description: "Does a thing",
      body: "# Body",
      exposeAsPrompt: false,
      toolGroupJson: "",
    });

    expect(draft.exposeAsPrompt).toBe(false);
  });

  it("omits capabilityGroup when toolGroupJson is whitespace-only", () => {
    const draft = formValuesToDraft({
      name: "x",
      description: "y",
      body: "z",
      exposeAsPrompt: true,
      toolGroupJson: "   \n  ",
    });
    expect(draft.capabilityGroup).toBeUndefined();
  });

  it("parses a valid toolGroupJson string into the capabilityGroup object", () => {
    const draft = formValuesToDraft({
      name: "My skill",
      description: "Does a thing",
      body: "# Body",
      exposeAsPrompt: true,
      toolGroupJson: JSON.stringify(toolGroup),
    });
    expect(draft.capabilityGroup).toEqual(toolGroup);
  });
});

describe("draftToFormValues", () => {
  it("returns empty strings for an undefined draft", () => {
    const values = draftToFormValues(undefined);
    expect(values.name).toBe("");
    expect(values.description).toBe("");
    expect(values.body).toBe("");
    expect(values.exposeAsPrompt).toBe(true);
    expect(values.toolGroupJson).toBe("");
  });

  it("serializes an existing capabilityGroup to a non-empty JSON string that parses back to the same object", () => {
    const draft: SkillDraft = {
      name: "My skill",
      description: "Does a thing",
      body: "# Body",
      exposeAsPrompt: true,
      capabilityGroup: toolGroup,
    };
    const values = draftToFormValues(draft);
    expect(values.exposeAsPrompt).toBe(true);
    expect(values.toolGroupJson).not.toBe("");
    expect(JSON.parse(values.toolGroupJson)).toEqual(toolGroup);
  });

  it("preserves exposeAsPrompt:false from existing drafts", () => {
    const values = draftToFormValues({
      name: "resource-only",
      description: "Does a thing",
      body: "# Body",
      exposeAsPrompt: false,
    });

    expect(values.exposeAsPrompt).toBe(false);
  });

  it("round-trip: draftToFormValues then formValuesToDraft returns a draft deep-equal to the original", () => {
    const original: SkillDraft = {
      name: "My skill",
      description: "Does a thing",
      body: "# Body",
      exposeAsPrompt: true,
      capabilityGroup: toolGroup,
    };
    const values = draftToFormValues(original);
    const roundTripped = formValuesToDraft(values);
    expect(roundTripped).toEqual(original);
  });
});
