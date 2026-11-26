import { pluralizeWithCount } from "./string-utils";

describe("pluralize", () => {
  it("returns the singular form when count is 1", () => {
    expect(pluralizeWithCount(1, "server")).toBe("1 server");
    expect(pluralizeWithCount(1, "entity")).toBe("1 entity");
  });

  it("appends -s for regular nouns when count is not 1", () => {
    expect(pluralizeWithCount(0, "server")).toBe("0 servers");
    expect(pluralizeWithCount(2, "user")).toBe("2 users");
    expect(pluralizeWithCount(7, "group")).toBe("7 groups");
  });

  it("converts consonant-y to -ies when count is not 1", () => {
    expect(pluralizeWithCount(2, "entity")).toBe("2 entities");
    expect(pluralizeWithCount(3, "category")).toBe("3 categories");
    expect(pluralizeWithCount(0, "policy")).toBe("0 policies");
  });

  it("appends -s (not -ies) for vowel-y nouns when count is not 1", () => {
    expect(pluralizeWithCount(2, "monkey")).toBe("2 monkeys");
    expect(pluralizeWithCount(3, "key")).toBe("3 keys");
    expect(pluralizeWithCount(2, "day")).toBe("2 days");
  });

  // Documents the rule's known limits: irregular English plurals are not handled.
  // Don't pass these words; if you do, you'll get the wrong output below.
  it("produces incorrect plurals for irregular nouns (known limitation)", () => {
    expect(pluralizeWithCount(2, "mouse")).toBe("2 mouses"); // should be "mice"
    expect(pluralizeWithCount(2, "child")).toBe("2 childs"); // should be "children"
    expect(pluralizeWithCount(2, "person")).toBe("2 persons"); // should be "people"
  });
});
