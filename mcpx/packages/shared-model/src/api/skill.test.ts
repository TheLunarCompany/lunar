import { skillNameSlugRegex } from "./skill.js";

// The one hand-written piece in these schemas; everything else is declarative zod.
describe("skillNameSlugRegex", () => {
  it("accepts kebab-case slugs", () => {
    for (const name of ["review-pull-requests", "review", "a1-b2"]) {
      expect(skillNameSlugRegex.test(name)).toBe(true);
    }
  });

  it("rejects non-slug names", () => {
    for (const name of [
      "Review pull requests",
      "review_prs",
      "Review",
      "-review-prs",
      "review-prs-",
      "review--prs",
      "",
    ]) {
      expect(skillNameSlugRegex.test(name)).toBe(false);
    }
  });
});
