import { McpxBoundPayloads } from "@mcpx/webapp-protocol/messages";
import z from "zod/v4";
import { mergeSetupConfig } from "./setup-manager.js";
import { Config } from "../model/config/config.js";

type ApplySetupPayload = z.infer<typeof McpxBoundPayloads.applySetup>;
type SetupConfigPayload = ApplySetupPayload["config"];

describe("mergeSetupConfig", () => {
  function createCurrent(): Config {
    return {
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: {},
      },
      auth: { enabled: true, header: "X-Auth" },
      toolGroups: [
        {
          name: "existing-group",
          services: { service1: ["tool1", "tool2"] },
        },
      ],
      toolExtensions: {
        services: {},
      },
      targetServerAttributes: {},
      staticOauth: undefined,
    };
  }

  function createIncoming(): SetupConfigPayload {
    return {
      toolGroups: [
        {
          name: "new-group",
          services: { service2: ["tool3"] },
        },
      ],
      toolExtensions: {
        services: {},
      },
      staticOauth: undefined,
    };
  }

  // Skipped test. Impl currently merges instead of overriding completely, which can create bugs:
  // If the Config.Permissions (not part of Setup atm) references a ToolGroup that is removed
  // in the incoming setup, that would lead to an invalid config state.
  // The current implementation merges toolGroups by name, so this edge-case is avoided.
  // however it creates a situation in which the tree_hash reported back upon applying a setup
  // is not the same as the one that was sent, which is potentially problematic.
  // Waiting for clarification from Roy G.
  it.skip("should override toolGroups completely", () => {
    const current = createCurrent();
    const incoming = createIncoming();

    const merged = mergeSetupConfig(current, incoming);

    expect(merged.toolGroups).toEqual(incoming.toolGroups);
    expect(merged.toolGroups).not.toEqual(current.toolGroups);
  });

  it("should preserve permissions from current config", () => {
    const current = createCurrent();
    const incoming = createIncoming();

    const merged = mergeSetupConfig(current, incoming);

    expect(merged.permissions).toEqual(current.permissions);
    expect(merged.permissions).toBe(current.permissions); // Same reference
  });

  it("should preserve auth from current config", () => {
    const current = createCurrent();
    const incoming = createIncoming();

    const merged = mergeSetupConfig(current, incoming);

    expect(merged.auth).toEqual(current.auth);
    expect(merged.auth).toBe(current.auth); // Same reference
  });

  it("should override staticOauth completely", () => {
    const current = createCurrent();
    const incoming: SetupConfigPayload = {
      ...createIncoming(),
      staticOauth: {
        mapping: {},
        providers: {},
      },
    };

    const merged = mergeSetupConfig(current, incoming);

    expect(merged.staticOauth).toEqual(incoming.staticOauth);
  });
});
