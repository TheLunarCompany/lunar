import { describe, expect, it } from "vitest";
import { parseSkillMarkdown } from "./skill-markdown";

describe("parseSkillMarkdown", () => {
  it("parses YAML frontmatter metadata and trims the Markdown body", () => {
    const markdown = [
      "---",
      "name: Review pull requests",
      "description: >-",
      "  Review repository changes",
      "  with local rules.",
      "---",
      "# Review pull requests",
      "",
      "Check tests, risks, and regressions.",
    ].join("\n");

    expect(parseSkillMarkdown(markdown)).toEqual({
      name: "Review pull requests",
      description: "Review repository changes with local rules.",
      body: "# Review pull requests\n\nCheck tests, risks, and regressions.",
    });
  });

  it("does not parse JavaScript frontmatter delimiters", () => {
    const markdown = [
      "---js",
      "module.exports = { name: 'Unsafe' }",
      "---",
      "# Safe fallback",
    ].join("\n");

    expect(parseSkillMarkdown(markdown)).toEqual({
      name: "Safe fallback",
      body: markdown,
    });
  });
});
