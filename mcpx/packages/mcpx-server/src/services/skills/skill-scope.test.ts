import { describe, expect, it } from "@jest/globals";
import { v7 as uuidv7 } from "uuid";
import { EnabledSkills, Skill } from "@mcpx/shared-model";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { SkillScope } from "./skill-scope.js";

const GITHUB_ITEM = uuidv7();
const SLACK_ITEM = uuidv7();

const GITHUB_SKILL = uuidv7();
const SLACK_SKILL = uuidv7();
const GROUPLESS_SKILL = uuidv7();

function makeSkill(props: {
  id: string;
  capabilityGroup?: Skill["capabilityGroup"];
}): Skill {
  return {
    id: props.id,
    name: `skill-${props.id.slice(-4)}`,
    description: "a skill",
    body: "do things",
    exposeAsPrompt: true,
    capabilityGroup: props.capabilityGroup,
    author: { setupOwnerId: "owner-1", displayName: "Owner" },
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    publishedAt: null,
  };
}

const githubSkill = makeSkill({
  id: GITHUB_SKILL,
  capabilityGroup: {
    items: [
      { catalogItemId: GITHUB_ITEM, tools: ["create_issue"], prompts: [] },
    ],
  },
});
const slackSkill = makeSkill({
  id: SLACK_SKILL,
  capabilityGroup: {
    items: [
      { catalogItemId: SLACK_ITEM, tools: ["post_message"], prompts: [] },
    ],
  },
});
const grouplessSkill = makeSkill({ id: GROUPLESS_SKILL });

const ALL_SKILLS = [githubSkill, slackSkill, grouplessSkill];

// serverName → catalogItemId as the real wiring would resolve it.
const CATALOG_ITEM_BY_SERVER: Record<string, string> = {
  github: GITHUB_ITEM,
  slack: SLACK_ITEM,
};

function makeScope(enabled: EnabledSkills[]): SkillScope {
  return new SkillScope(
    {
      getEnabledSkills: () => enabled,
      getSkills: () => ALL_SKILLS,
      getCatalogItemId: (serverName) => CATALOG_ITEM_BY_SERVER[serverName],
    },
    noOpLogger,
  );
}

function canCallTool(
  scope: SkillScope,
  consumer: { consumerTag?: string; clientName?: string },
  server: string,
  tool: string,
): boolean {
  return scope.hasPermission({
    capabilityKind: "tools",
    serviceName: server,
    capabilityName: tool,
    ...consumer,
  });
}

describe("SkillScope", () => {
  describe("hasPermission", () => {
    it("unions capabilities across multiple enabled skills", () => {
      const scope = makeScope([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [GITHUB_SKILL, SLACK_SKILL],
        },
      ]);
      const devs = { consumerTag: "devs" };
      expect(canCallTool(scope, devs, "github", "create_issue")).toBe(true);
      expect(canCallTool(scope, devs, "slack", "post_message")).toBe(true);
      expect(canCallTool(scope, devs, "github", "delete_repo")).toBe(false);
    });

    it("stays unrestricted when the enabled skill id is not in the store", () => {
      const scope = makeScope([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [uuidv7()],
        },
      ]);
      expect(
        canCallTool(scope, { consumerTag: "devs" }, "github", "anything"),
      ).toBe(true);
    });

    it("allows everything when nothing is enabled for the consumer", () => {
      const scope = makeScope([]);
      expect(canCallTool(scope, { consumerTag: "devs" }, "github", "x")).toBe(
        true,
      );
      expect(canCallTool(scope, {}, "github", "x")).toBe(true);
    });

    it("restricts an enabled subject to its skills' capabilities", () => {
      const scope = makeScope([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [GITHUB_SKILL],
        },
      ]);
      const devs = { consumerTag: "devs" };
      expect(canCallTool(scope, devs, "github", "create_issue")).toBe(true);
      expect(canCallTool(scope, devs, "github", "delete_repo")).toBe(false);
      expect(canCallTool(scope, devs, "slack", "post_message")).toBe(false);
    });

    it("leaves other subjects unrestricted", () => {
      const scope = makeScope([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [GITHUB_SKILL],
        },
      ]);
      expect(
        canCallTool(scope, { consumerTag: "support" }, "slack", "anything"),
      ).toBe(true);
    });

    it("stays unrestricted when only group-less skills are enabled", () => {
      const scope = makeScope([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [GROUPLESS_SKILL],
        },
      ]);
      expect(
        canCallTool(scope, { consumerTag: "devs" }, "github", "anything"),
      ).toBe(true);
    });

    it("denies servers with no catalog identity for a scoped subject", () => {
      const scope = makeScope([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [GITHUB_SKILL],
        },
      ]);
      expect(
        // "custom-server" has no catalog item
        canCallTool(scope, { consumerTag: "devs" }, "custom-server", "x"),
      ).toBe(false);
    });

    describe("dangling skill ids (cleaned at refresh)", () => {
      it("a fully-dangling tag entry does not govern; clientName does", () => {
        const scope = makeScope([
          {
            subject: { kind: "consumerTag", value: "devs" },
            skillIds: [uuidv7()], // dangling
          },
          {
            subject: { kind: "clientName", value: "cursor" },
            skillIds: [GITHUB_SKILL],
          },
        ]);
        const consumer = { consumerTag: "devs", clientName: "cursor" };
        expect(canCallTool(scope, consumer, "slack", "post_message")).toBe(
          false,
        );
        expect(canCallTool(scope, consumer, "github", "create_issue")).toBe(
          true,
        );
      });

      it("a dangling id is not reported as enabled", () => {
        const danglingId = uuidv7();
        const scope = makeScope([
          {
            subject: { kind: "consumerTag", value: "devs" },
            skillIds: [GITHUB_SKILL, danglingId],
          },
        ]);
        const devs = { consumerTag: "devs" };
        expect(scope.isEnabled(devs, GITHUB_SKILL)).toBe(true);
        expect(scope.isEnabled(devs, danglingId)).toBe(false);
      });
    });

    describe("subject precedence", () => {
      it("consumerTag governs even when its skills are all group-less", () => {
        const scope = makeScope([
          {
            subject: { kind: "consumerTag", value: "devs" },
            skillIds: [GROUPLESS_SKILL],
          },
          {
            subject: { kind: "clientName", value: "cursor" },
            skillIds: [GITHUB_SKILL],
          },
        ]);
        const consumer = { consumerTag: "devs", clientName: "cursor" };
        expect(canCallTool(scope, consumer, "slack", "anything")).toBe(true);
      });

      it("falls back to clientName when the tag has nothing enabled", () => {
        const scope = makeScope([
          {
            subject: { kind: "clientName", value: "cursor" },
            skillIds: [GITHUB_SKILL],
          },
        ]);
        const consumer = { consumerTag: "devs", clientName: "cursor" };
        expect(canCallTool(scope, consumer, "github", "create_issue")).toBe(
          true,
        );
        expect(canCallTool(scope, consumer, "slack", "post_message")).toBe(
          false,
        );
      });
    });
  });

  describe("isEnabled", () => {
    it("reflects the governing subject's enabled set", () => {
      const scope = makeScope([
        {
          subject: { kind: "consumerTag", value: "devs" },
          skillIds: [GITHUB_SKILL, GROUPLESS_SKILL],
        },
      ]);
      const devs = { consumerTag: "devs" };
      expect(scope.isEnabled(devs, GITHUB_SKILL)).toBe(true);
      expect(scope.isEnabled(devs, GROUPLESS_SKILL)).toBe(true);
      expect(scope.isEnabled(devs, SLACK_SKILL)).toBe(false);
    });

    it("is false for consumers with nothing enabled", () => {
      const scope = makeScope([]);
      expect(scope.isEnabled({ consumerTag: "devs" }, GITHUB_SKILL)).toBe(
        false,
      );
    });
  });

  describe("refresh", () => {
    it("picks up config changes", () => {
      const enabled: EnabledSkills[] = [];
      const scope = new SkillScope(
        {
          getEnabledSkills: () => enabled,
          getSkills: () => ALL_SKILLS,
          getCatalogItemId: (serverName) => CATALOG_ITEM_BY_SERVER[serverName],
        },
        noOpLogger,
      );
      const devs = { consumerTag: "devs" };
      // Nothing enabled yet: unrestricted.
      expect(canCallTool(scope, devs, "slack", "post_message")).toBe(true);
      expect(canCallTool(scope, devs, "github", "create_issue")).toBe(true);
      enabled.push({
        subject: { kind: "consumerTag", value: "devs" },
        skillIds: [GITHUB_SKILL],
      });
      scope.refresh();
      // After refresh the github skill scopes devs: slack out, github in.
      expect(canCallTool(scope, devs, "slack", "post_message")).toBe(false);
      expect(canCallTool(scope, devs, "github", "create_issue")).toBe(true);
    });
  });
});
