import { describe, it, expect } from "@jest/globals";
import { DEFAULT_CONFIG } from "../../config.js";
import { Config } from "../../model/config/config.js";
import { ToolGroup } from "../../model/config/permissions.js";
import { diffConfigForAudit } from "./audit-log-diff.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return { ...structuredClone(DEFAULT_CONFIG), ...overrides };
}

describe("diffConfigForAudit", () => {
  it("emits nothing when nothing changed", () => {
    const config = makeConfig();
    expect(diffConfigForAudit({ prev: config, next: config })).toEqual([]);
  });

  it("emits nothing when only targetServerAttributes changed", () => {
    const prev = makeConfig({ targetServerAttributes: {} });
    const next = makeConfig({
      targetServerAttributes: { github: { inactive: true } },
    });
    expect(diffConfigForAudit({ prev, next })).toEqual([]);
  });

  it("emits added servers when a new consumer entry is created", () => {
    const prev = makeConfig({
      toolGroups: [
        { name: "g1", services: { github: ["create_issue"], jira: "*" } },
      ],
    });
    const next = makeConfig({
      toolGroups: [
        { name: "g1", services: { github: ["create_issue"], jira: "*" } },
      ],
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g1"] } },
        clientNames: {},
      },
    });
    expect(diffConfigForAudit({ prev, next })).toEqual([
      {
        eventType: "agent_permission_updated",
        payload: {
          name: "dev",
          identityType: "consumers",
          addedServers: ["github", "jira"],
          removedServers: [],
        },
      },
    ]);
  });

  it("emits removed servers when a consumer entry is deleted", () => {
    const prev = makeConfig({
      toolGroups: [{ name: "g1", services: { slack: "*" } }],
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g1"] } },
        clientNames: {},
      },
    });
    const next = makeConfig({
      toolGroups: [{ name: "g1", services: { slack: "*" } }],
    });
    expect(diffConfigForAudit({ prev, next })).toEqual([
      {
        eventType: "agent_permission_updated",
        payload: {
          name: "dev",
          identityType: "consumers",
          addedServers: [],
          removedServers: ["slack"],
        },
      },
    ]);
  });

  it("emits diff when a consumer entry's referenced toolGroups change", () => {
    const toolGroups: ToolGroup[] = [
      { name: "g1", services: { github: "*" } },
      { name: "g2", services: { jira: "*" } },
    ];
    const prev = makeConfig({
      toolGroups,
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g1"] } },
        clientNames: {},
      },
    });
    const next = makeConfig({
      toolGroups,
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g2"] } },
        clientNames: {},
      },
    });
    expect(diffConfigForAudit({ prev, next })).toEqual([
      {
        eventType: "agent_permission_updated",
        payload: {
          name: "dev",
          identityType: "consumers",
          addedServers: ["jira"],
          removedServers: ["github"],
        },
      },
    ]);
  });

  it("emits diff when a toolGroup's contents add a new server while the consumer reference is stable", () => {
    const prev = makeConfig({
      toolGroups: [{ name: "g1", services: { github: "*" } }],
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g1"] } },
        clientNames: {},
      },
    });
    const next = makeConfig({
      toolGroups: [{ name: "g1", services: { github: "*", linear: "*" } }],
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g1"] } },
        clientNames: {},
      },
    });
    expect(diffConfigForAudit({ prev, next })).toEqual([
      {
        eventType: "agent_permission_updated",
        payload: {
          name: "dev",
          identityType: "consumers",
          addedServers: ["linear"],
          removedServers: [],
        },
      },
    ]);
  });

  // The audit event is intentionally at server granularity. If only the tool
  // list inside a group changes but the consumer's reachable server set is
  // identical, no agent_permission_updated event is emitted — tool-level
  // changes are captured separately via catalog_updated.approvedToolsChanges.
  it("emits nothing when toolGroup contents change but the referenced server set is stable", () => {
    const prev = makeConfig({
      toolGroups: [{ name: "g1", services: { github: ["a"] } }],
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g1"] } },
        clientNames: {},
      },
    });
    const next = makeConfig({
      toolGroups: [{ name: "g1", services: { github: ["a", "b"] } }],
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g1"] } },
        clientNames: {},
      },
    });
    expect(diffConfigForAudit({ prev, next })).toEqual([]);
  });

  it("handles default-allow entries (toolGroups in block list)", () => {
    const toolGroups = [{ name: "g1", services: { slack: "*" as const } }];
    const prev = makeConfig({ toolGroups });
    const next = makeConfig({
      toolGroups,
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { qa: { _type: "default-allow", block: ["g1"] } },
        clientNames: {},
      },
    });
    expect(diffConfigForAudit({ prev, next })).toEqual([
      {
        eventType: "agent_permission_updated",
        payload: {
          name: "qa",
          identityType: "consumers",
          addedServers: ["slack"],
          removedServers: [],
        },
      },
    ]);
  });

  it("emits per-identityType events for consumers and clientNames", () => {
    const toolGroups = [{ name: "g1", services: { github: "*" as const } }];
    const prev = makeConfig({ toolGroups });
    const next = makeConfig({
      toolGroups,
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: { dev: { _type: "default-block", allow: ["g1"] } },
        clientNames: { cursor: { _type: "default-block", allow: ["g1"] } },
      },
    });
    const events = diffConfigForAudit({ prev, next });
    expect(events).toHaveLength(2);
    expect(events).toContainEqual({
      eventType: "agent_permission_updated",
      payload: {
        name: "dev",
        identityType: "consumers",
        addedServers: ["github"],
        removedServers: [],
      },
    });
    expect(events).toContainEqual({
      eventType: "agent_permission_updated",
      payload: {
        name: "cursor",
        identityType: "clientNames",
        addedServers: ["github"],
        removedServers: [],
      },
    });
  });
});
