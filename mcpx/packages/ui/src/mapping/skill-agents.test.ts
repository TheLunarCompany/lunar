import type {
  EnabledSkills,
  Skill,
  ScopeSubject,
  SystemState,
} from "@mcpx/shared-model";
import { describe, expect, it } from "vitest";

import type { Agent } from "../types/agent";

import {
  buildAgentSkills,
  buildSkillAgentSelection,
  diffScopeSubjects,
} from "./skill-agents";

const SKILL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SKILL_ID = "22222222-2222-4222-8222-222222222222";

describe("buildSkillAgentSelection", () => {
  it("maps a consumer-tag cluster to exactly one consumer-tag option", () => {
    const result = buildSkillAgentSelection({
      clusters: [consumerTagCluster("engineering", ["Cursor", "Claude Code"])],
      enabled: [],
      skillId: SKILL_ID,
    });

    expect(result).toEqual({
      options: [
        {
          key: "consumerTag:engineering",
          subject: { kind: "consumerTag", value: "engineering" },
          label: "engineering",
          connected: true,
        },
      ],
      selected: [],
    });
  });

  it("maps a client-name cluster to exactly one client-name option", () => {
    const result = buildSkillAgentSelection({
      clusters: [clientNameCluster("Claude Code")],
      enabled: [],
      skillId: SKILL_ID,
    });

    expect(result.options).toEqual([
      {
        key: "clientName:Claude Code",
        subject: { kind: "clientName", value: "Claude Code" },
        label: "Claude Code",
        connected: true,
      },
    ]);
  });

  it("excludes anonymous clusters", () => {
    const result = buildSkillAgentSelection({
      clusters: [anonymousCluster()],
      enabled: [],
      skillId: SKILL_ID,
    });

    expect(result.options).toEqual([]);
  });

  it("does not emit client-name options nested under a consumer-tag cluster", () => {
    const result = buildSkillAgentSelection({
      clusters: [consumerTagCluster("engineering", ["Cursor", "Claude Code"])],
      enabled: [],
      skillId: SKILL_ID,
    });

    expect(result.options.map((option) => option.subject)).toEqual([
      { kind: "consumerTag", value: "engineering" },
    ]);
  });

  it("includes a configured selected subject as disconnected when it is not live", () => {
    const configuredSubject: ScopeSubject = {
      kind: "consumerTag",
      value: "offline-team",
    };

    const result = buildSkillAgentSelection({
      clusters: [],
      enabled: [enabledRow(configuredSubject, [SKILL_ID])],
      skillId: SKILL_ID,
    });

    expect(result).toEqual({
      options: [
        {
          key: "consumerTag:offline-team",
          subject: configuredSubject,
          label: "offline-team",
          connected: false,
        },
      ],
      selected: [configuredSubject],
    });
  });

  it("does not select this skill for a row containing only another skill", () => {
    const subject: ScopeSubject = { kind: "clientName", value: "Cursor" };

    const result = buildSkillAgentSelection({
      clusters: [clientNameCluster("Cursor")],
      enabled: [enabledRow(subject, [OTHER_SKILL_ID])],
      skillId: SKILL_ID,
    });

    expect(result.selected).toEqual([]);
    expect(result.options).toHaveLength(1);
  });

  it("collapses duplicate live and configured subjects by canonical subject key", () => {
    const subject: ScopeSubject = { kind: "clientName", value: "Cursor" };

    const result = buildSkillAgentSelection({
      clusters: [clientNameCluster("Cursor"), clientNameCluster("Cursor")],
      enabled: [
        enabledRow(subject, [SKILL_ID]),
        enabledRow({ ...subject }, [SKILL_ID]),
      ],
      skillId: SKILL_ID,
    });

    expect(result.options).toHaveLength(1);
    expect(result.options[0]).toMatchObject({
      key: "clientName:Cursor",
      connected: true,
    });
    expect(result.selected).toEqual([subject]);
  });

  it("orders connected options first, then by case-insensitive value, then kind", () => {
    const result = buildSkillAgentSelection({
      clusters: [
        clientNameCluster("zulu"),
        consumerTagCluster("Alpha"),
        clientNameCluster("same"),
        consumerTagCluster("same"),
      ],
      enabled: [
        enabledRow({ kind: "clientName", value: "beta" }, [SKILL_ID]),
        enabledRow({ kind: "consumerTag", value: "aardvark" }, [SKILL_ID]),
      ],
      skillId: SKILL_ID,
    });

    expect(result.options.map((option) => option.key)).toEqual([
      "consumerTag:Alpha",
      "clientName:same",
      "consumerTag:same",
      "clientName:zulu",
      "consumerTag:aardvark",
      "clientName:beta",
    ]);
  });
});

describe("diffScopeSubjects", () => {
  it("returns only added and removed subjects independent of input order", () => {
    const retainedClient: ScopeSubject = {
      kind: "clientName",
      value: "Cursor",
    };
    const retainedTag: ScopeSubject = {
      kind: "consumerTag",
      value: "engineering",
    };
    const removed: ScopeSubject = { kind: "clientName", value: "Windsurf" };
    const added: ScopeSubject = { kind: "consumerTag", value: "support" };

    expect(
      diffScopeSubjects({
        previous: [removed, retainedTag, retainedClient],
        next: [retainedClient, added, retainedTag],
      }),
    ).toEqual({ added: [added], removed: [removed] });

    expect(
      diffScopeSubjects({
        previous: [retainedClient, retainedTag],
        next: [retainedTag, retainedClient],
      }),
    ).toEqual({ added: [], removed: [] });
  });
});

describe("buildAgentSkills", () => {
  it("resolves consumer-tag assignments and sorts skills by name", () => {
    const alpha = skill(SKILL_ID, "alpha-skill");
    const zebra = skill(OTHER_SKILL_ID, "Zebra skill");

    expect(
      buildAgentSkills({
        agent: consumerTagAgent("engineering"),
        enabled: [
          enabledRow({ kind: "consumerTag", value: "engineering" }, [
            OTHER_SKILL_ID,
            SKILL_ID,
          ]),
        ],
        skills: [zebra, alpha],
      }),
    ).toEqual([alpha, zebra]);
  });

  it("resolves client-name assignments without matching consumer tags", () => {
    const clientSkill = skill(SKILL_ID, "client-skill");

    expect(
      buildAgentSkills({
        agent: clientNameAgent("Cursor"),
        enabled: [
          enabledRow({ kind: "consumerTag", value: "Cursor" }, [
            OTHER_SKILL_ID,
          ]),
          enabledRow({ kind: "clientName", value: "Cursor" }, [SKILL_ID]),
        ],
        skills: [clientSkill],
      }),
    ).toEqual([clientSkill]);
  });

  it("returns no skills for anonymous agents and ignores stale skill IDs", () => {
    const knownSkill = skill(SKILL_ID, "known-skill");
    const enabled = [
      enabledRow({ kind: "consumerTag", value: "engineering" }, [
        SKILL_ID,
        OTHER_SKILL_ID,
      ]),
    ];

    expect(
      buildAgentSkills({
        agent: consumerTagAgent("engineering"),
        enabled,
        skills: [knownSkill],
      }),
    ).toEqual([knownSkill]);

    expect(
      buildAgentSkills({
        agent: anonymousAgent(),
        enabled,
        skills: [knownSkill],
      }),
    ).toEqual([]);
  });
});

function enabledRow(subject: ScopeSubject, skillIds: string[]): EnabledSkills {
  return { subject, skillIds };
}

function skill(id: string, name: string): Skill {
  return {
    id,
    name,
    description: `${name} description`,
    body: `# ${name}`,
    exposeAsPrompt: true,
    author: { setupOwnerId: "owner-1", displayName: "Owner" },
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
  };
}

function consumerTagAgent(consumerTag: string): Agent {
  return {
    id: "agent-1",
    identifier: consumerTag,
    sessionIds: ["session-1"],
    status: "CONNECTED",
    usage: { callCount: 0 },
    dynamicMode: false,
    visibleTools: [],
    connectionState: "connected",
    identityType: "consumerTag",
    consumerTag,
    clientNames: [],
  };
}

function clientNameAgent(clientName: string): Agent {
  return {
    id: "agent-1",
    identifier: clientName,
    sessionIds: ["session-1"],
    status: "CONNECTED",
    usage: { callCount: 0 },
    dynamicMode: false,
    visibleTools: [],
    connectionState: "connected",
    identityType: "clientName",
    clientName,
  };
}

function anonymousAgent(): Agent {
  return {
    id: "agent-1",
    identifier: "anonymous",
    sessionIds: ["session-1"],
    status: "CONNECTED",
    usage: { callCount: 0 },
    dynamicMode: false,
    visibleTools: [],
    connectionState: "connected",
    identityType: "anonymous",
  };
}

function consumerTagCluster(
  consumerTag: string,
  clientNames: string[] = [],
): SystemState["connectedClientClusters"][number] {
  return {
    identityType: "consumerTag",
    consumerTag,
    clientNames,
    sessionIds: [],
    usage: { callCount: 0 },
  };
}

function clientNameCluster(
  clientName: string,
): SystemState["connectedClientClusters"][number] {
  return {
    identityType: "clientName",
    clientName,
    sessionIds: [],
    usage: { callCount: 0 },
  };
}

function anonymousCluster(): SystemState["connectedClientClusters"][number] {
  return {
    identityType: "anonymous",
    sessionIds: [],
    usage: { callCount: 0 },
  };
}
