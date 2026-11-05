import { describe, expect, it } from "@jest/globals";
import { v7 as uuidv7 } from "uuid";
import { ScopeSubject, scopeSubjectKey } from "@mcpx/shared-model";
import {
  buildScopeIndex,
  CapabilityGroupItem,
  ScopeIndex,
  SubjectScope,
} from "./capability-scope.js";
import { subjectScopeAllows } from "./capability-scope.js";

const GITHUB = uuidv7();
const SLACK = uuidv7();

const devs: ScopeSubject = { kind: "consumerTag", value: "devs" };

type ItemSelections = Partial<Pick<CapabilityGroupItem, "tools" | "prompts">>;

function githubItem(selections: ItemSelections = {}): CapabilityGroupItem {
  return { catalogItemId: GITHUB, tools: [], prompts: [], ...selections };
}

function slackItem(selections: ItemSelections = {}): CapabilityGroupItem {
  return { catalogItemId: SLACK, tools: [], prompts: [], ...selections };
}

function scopeOf(index: ScopeIndex, subject: ScopeSubject): SubjectScope {
  const scope = index.get(scopeSubjectKey(subject));
  if (!scope) throw new Error("expected subject scope");
  return scope;
}

function allows(
  scope: SubjectScope,
  props: { kind: "tools" | "prompts" | "resources"; catalogItemId: string },
  capability: string,
): boolean {
  return subjectScopeAllows({ scope, ...props, capability });
}

describe("buildScopeIndex", () => {
  describe("subjects with no effective selection", () => {
    it("indexes nothing when there are no entries → unrestricted", () => {
      expect(buildScopeIndex([]).size).toBe(0);
    });

    it("drops a subject whose groups select nothing → unrestricted", () => {
      const index = buildScopeIndex([{ subject: devs, groupItems: [] }]);
      expect(index.has(scopeSubjectKey(devs))).toBe(false);
    });
  });

  describe("single item", () => {
    it("allows a listed tool, denies an unlisted one", () => {
      const index = buildScopeIndex([
        {
          subject: devs,
          groupItems: [githubItem({ tools: ["create_issue"] })],
        },
      ]);
      const scope = scopeOf(index, devs);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "create_issue"),
      ).toBe(true);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "delete_repo"),
      ).toBe(false);
    });

    it("denies all tools when the item selects none", () => {
      const index = buildScopeIndex([
        { subject: devs, groupItems: [githubItem({ prompts: ["triage"] })] },
      ]);
      expect(
        allows(
          scopeOf(index, devs),
          { kind: "tools", catalogItemId: GITHUB },
          "create_issue",
        ),
      ).toBe(false);
    });

    it("allows everything on '*'", () => {
      const index = buildScopeIndex([
        { subject: devs, groupItems: [githubItem({ tools: "*" })] },
      ]);
      expect(
        allows(
          scopeOf(index, devs),
          { kind: "tools", catalogItemId: GITHUB },
          "whatever",
        ),
      ).toBe(true);
    });

    it("denies capabilities of an item that no group selects", () => {
      const index = buildScopeIndex([
        { subject: devs, groupItems: [githubItem({ tools: "*" })] },
      ]);
      const scope = scopeOf(index, devs);
      expect(
        allows(scope, { kind: "tools", catalogItemId: SLACK }, "post_message"),
      ).toBe(false);
    });
  });

  describe("per-kind split", () => {
    it("gates tools and prompts independently", () => {
      const index = buildScopeIndex([
        {
          subject: devs,
          groupItems: [
            githubItem({ tools: ["create_issue"], prompts: ["triage"] }),
          ],
        },
      ]);
      const scope = scopeOf(index, devs);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "create_issue"),
      ).toBe(true);
      expect(
        allows(
          scope,
          { kind: "prompts", catalogItemId: GITHUB },
          "create_issue",
        ),
      ).toBe(false);
      expect(
        allows(scope, { kind: "prompts", catalogItemId: GITHUB }, "triage"),
      ).toBe(true);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "triage"),
      ).toBe(false);
    });

    it("never grants resources", () => {
      const index = buildScopeIndex([
        {
          subject: devs,
          groupItems: [githubItem({ tools: "*", prompts: "*" })],
        },
      ]);
      expect(
        allows(
          scopeOf(index, devs),
          { kind: "resources", catalogItemId: GITHUB },
          "any",
        ),
      ).toBe(false);
    });
  });

  describe("union across items of the same catalog item", () => {
    it("merges name lists", () => {
      const index = buildScopeIndex([
        {
          subject: devs,
          groupItems: [
            githubItem({ tools: ["create_issue"] }),
            githubItem({ tools: ["list_issues"] }),
          ],
        },
      ]);
      const scope = scopeOf(index, devs);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "create_issue"),
      ).toBe(true);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "list_issues"),
      ).toBe(true);
    });

    it("'*' absorbs lists", () => {
      const index = buildScopeIndex([
        {
          subject: devs,
          groupItems: [
            githubItem({ tools: ["create_issue"] }),
            githubItem({ tools: "*" }),
          ],
        },
      ]);
      expect(
        allows(
          scopeOf(index, devs),
          { kind: "tools", catalogItemId: GITHUB },
          "anything",
        ),
      ).toBe(true);
    });

    it("merges per kind, not across kinds", () => {
      const index = buildScopeIndex([
        {
          subject: devs,
          groupItems: [
            githubItem({ tools: "*" }),
            githubItem({ prompts: ["triage"] }),
          ],
        },
      ]);
      const scope = scopeOf(index, devs);
      expect(
        allows(scope, { kind: "prompts", catalogItemId: GITHUB }, "triage"),
      ).toBe(true);
      expect(
        allows(scope, { kind: "prompts", catalogItemId: GITHUB }, "other"),
      ).toBe(false);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "anything"),
      ).toBe(true);
    });
  });

  describe("two groups enabled for one subject", () => {
    it("allows the union of both groups, nothing beyond", () => {
      const githubGroup = [githubItem({ tools: ["create_issue"] })];
      const slackGroup = [slackItem({ tools: ["post_message"] })];
      const index = buildScopeIndex([
        { subject: devs, groupItems: [...githubGroup, ...slackGroup] },
      ]);
      const scope = scopeOf(index, devs);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "create_issue"),
      ).toBe(true);
      expect(
        allows(scope, { kind: "tools", catalogItemId: SLACK }, "post_message"),
      ).toBe(true);
      expect(
        allows(scope, { kind: "tools", catalogItemId: GITHUB }, "delete_repo"),
      ).toBe(false);
      expect(
        allows(scope, { kind: "tools", catalogItemId: SLACK }, "list_channels"),
      ).toBe(false);
    });

    it("dedupes overlapping selections across groups", () => {
      const githubGroup = [
        githubItem({ tools: ["create_issue", "list_issues"] }),
      ];
      const otherGithubGroup = [
        githubItem({ tools: ["list_issues", "close_issue"] }),
      ];
      const index = buildScopeIndex([
        { subject: devs, groupItems: [...githubGroup, ...otherGithubGroup] },
      ]);
      const tools = scopeOf(index, devs).get(GITHUB)?.tools;
      expect(tools).toEqual(
        new Set(["create_issue", "list_issues", "close_issue"]),
      );
    });
  });

  describe("multiple subjects", () => {
    it("keeps subjects independent", () => {
      const support: ScopeSubject = { kind: "clientName", value: "support" };
      const index = buildScopeIndex([
        {
          subject: devs,
          groupItems: [githubItem({ tools: ["create_issue"] })],
        },
        {
          subject: support,
          groupItems: [slackItem({ tools: ["post_message"] })],
        },
      ]);
      const devsScope = scopeOf(index, devs);
      const supportScope = scopeOf(index, support);
      expect(
        allows(
          devsScope,
          { kind: "tools", catalogItemId: GITHUB },
          "create_issue",
        ),
      ).toBe(true);
      expect(
        allows(
          devsScope,
          { kind: "tools", catalogItemId: SLACK },
          "post_message",
        ),
      ).toBe(false);
      expect(
        allows(
          supportScope,
          { kind: "tools", catalogItemId: SLACK },
          "post_message",
        ),
      ).toBe(true);
      expect(
        allows(
          supportScope,
          { kind: "tools", catalogItemId: GITHUB },
          "create_issue",
        ),
      ).toBe(false);
    });

    it("distinguishes same value under different subject kinds", () => {
      const byTag: ScopeSubject = { kind: "consumerTag", value: "ops" };
      const byClient: ScopeSubject = { kind: "clientName", value: "ops" };
      const index = buildScopeIndex([
        {
          subject: byTag,
          groupItems: [githubItem({ tools: ["create_issue"] })],
        },
      ]);
      expect(index.has(scopeSubjectKey(byTag))).toBe(true);
      expect(index.has(scopeSubjectKey(byClient))).toBe(false);
    });
  });
});
