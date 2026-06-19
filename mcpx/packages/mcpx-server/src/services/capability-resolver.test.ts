import { noOpLogger } from "@mcpx/toolkit-core/logging";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  CapabilityKind,
  CapabilityOrigin,
  CapabilityRegistry,
  RegisteredPrompt,
  RegisteredTool,
} from "./capability-registry.js";
import { CapabilityResolver, PermissionCheck } from "./capability-resolver.js";
import { CatalogChange, CatalogManagerI } from "./catalog-manager.js";
import { SERVICE_DELIMITER } from "./oauth-tools.js";

function makeTool(
  name: string,
  origin: CapabilityOrigin = "upstream",
): RegisteredTool {
  return {
    definition: {
      name,
      description: `Tool ${name}`,
      inputSchema: { type: "object", properties: {} },
    },
    origin,
  };
}

function makePrompt(
  name: string,
  origin: CapabilityOrigin = "upstream",
): RegisteredPrompt {
  return {
    definition: {
      name,
      description: `Prompt ${name}`,
    },
    origin,
  };
}

type CatalogState = {
  isStrict: boolean;
  approvals: Map<string, string[] | null>; // null = all approved
};

const NOOP_CHANGE: CatalogChange = {
  addedServers: [],
  removedServers: [],
  approvedToolsChanges: [],
  strictnessChanged: false,
};

function makeCatalog(state: CatalogState): CatalogManagerI {
  const listeners = new Set<(change: CatalogChange) => void>();
  return {
    isStrict: () => state.isStrict,
    isServerApproved: (server: string) => {
      if (!state.isStrict) return true;
      return state.approvals.has(server);
    },
    isToolApproved: (server: string, tool: string) => {
      if (!state.isStrict) return true;
      const serverApprovals = state.approvals.get(server);
      if (serverApprovals === undefined) return false;
      if (serverApprovals === null) return true;
      return serverApprovals.includes(tool);
    },
    isPromptApproved: (server: string, prompt: string) => {
      if (!state.isStrict) return true;
      const serverApprovals = state.approvals.get(server);
      if (serverApprovals === undefined) return false;
      if (serverApprovals === null) return true;
      return serverApprovals.includes(prompt);
    },
    subscribe: (cb: (change: CatalogChange) => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    _notify: (change: CatalogChange = NOOP_CHANGE) => {
      for (const cb of listeners) cb(change);
    },
  } as unknown as CatalogManagerI & {
    _notify(change?: CatalogChange): void;
  };
}

// Default permission stub: allow everything. Individual tests can override.
function makePermissions(
  decide: (props: {
    capabilityKind: CapabilityKind;
    serviceName: string;
    capabilityName: string;
    consumerTag?: string;
    clientName?: string;
  }) => boolean = () => true,
): PermissionCheck {
  return { hasPermission: decide };
}

function setup(
  catalogState: CatalogState = { isStrict: false, approvals: new Map() },
  permissions: PermissionCheck = makePermissions(),
) {
  const registry = new CapabilityRegistry(noOpLogger);
  const catalog = makeCatalog(catalogState) as CatalogManagerI & {
    _notify(): void;
  };
  const resolver = new CapabilityResolver(
    registry,
    catalog,
    permissions,
    noOpLogger,
  );
  return { registry, catalog, resolver };
}

describe("CapabilityResolver", () => {
  let registry: CapabilityRegistry;
  let catalog: CatalogManagerI & { _notify(change?: CatalogChange): void };
  let resolver: CapabilityResolver;

  beforeEach(() => {
    ({ registry, catalog, resolver } = setup());
  });

  afterEach(() => {
    resolver.shutdown();
    registry.shutdown();
  });

  describe("non-strict mode (default)", () => {
    it("exposes all registered tools", () => {
      registry.registerServer("github", {
        tools: [makeTool("create_issue"), makeTool("list_issues")],
      });

      expect(resolver.activeTools.size).toBe(2);
      expect(
        resolver.activeTools.has(`github${SERVICE_DELIMITER}create_issue`),
      ).toBe(true);
    });

    it("tools are prefixed with serverName and SERVICE_DELIMITER", () => {
      registry.registerServer("slack", { tools: [makeTool("send_message")] });

      const key = `slack${SERVICE_DELIMITER}send_message`;
      const cap = resolver.activeTools.get(key);
      expect(cap?.serverName).toBe("slack");
      expect(cap?.capabilityName).toBe("send_message");
      expect(cap?.definition.name).toBe(key);
    });

    it("merges tools from multiple servers", () => {
      registry.registerServer("github", { tools: [makeTool("a")] });
      registry.registerServer("slack", { tools: [makeTool("b")] });

      expect(resolver.activeTools.size).toBe(2);
    });
  });

  describe("strict mode — approval filtering", () => {
    beforeEach(() => {
      ({ registry, catalog, resolver } = setup({
        isStrict: true,
        approvals: new Map(),
      }));
    });

    it("denies all tools when no approval entry exists for server", () => {
      registry.registerServer("github", { tools: [makeTool("create_issue")] });
      expect(resolver.activeTools.size).toBe(0);
    });

    it("approves only listed tools", () => {
      const approvals = new Map<string, string[] | null>([
        ["github", ["create_issue"]],
      ]);
      ({ registry, catalog, resolver } = setup({ isStrict: true, approvals }));

      registry.registerServer("github", {
        tools: [makeTool("create_issue"), makeTool("list_issues")],
      });

      expect(resolver.activeTools.size).toBe(1);
      expect(
        resolver.activeTools.has(`github${SERVICE_DELIMITER}create_issue`),
      ).toBe(true);
      expect(
        resolver.activeTools.has(`github${SERVICE_DELIMITER}list_issues`),
      ).toBe(false);
    });

    it("null approval entry approves all tools for that server", () => {
      const approvals = new Map<string, string[] | null>([["github", null]]);
      ({ registry, catalog, resolver } = setup({ isStrict: true, approvals }));

      registry.registerServer("github", {
        tools: [makeTool("a"), makeTool("b")],
      });

      expect(resolver.activeTools.size).toBe(2);
    });
  });

  describe("extended child tool expansion", () => {
    it("approves child tool when parent is approved", () => {
      const approvals = new Map<string, string[] | null>([
        ["github", ["create_issue"]],
      ]);
      ({ registry, catalog, resolver } = setup({ isStrict: true, approvals }));

      registry.registerServer("github", {
        tools: [makeTool("create_issue"), makeTool("create_issue_for_project")],
        toolParentNames: { create_issue_for_project: "create_issue" },
      });

      expect(resolver.activeTools.size).toBe(2);
      expect(
        resolver.activeTools.has(
          `github${SERVICE_DELIMITER}create_issue_for_project`,
        ),
      ).toBe(true);
    });

    it("denies child tool when parent is not approved", () => {
      const approvals = new Map<string, string[] | null>([
        ["github", ["other_tool"]],
      ]);
      ({ registry, catalog, resolver } = setup({ isStrict: true, approvals }));

      registry.registerServer("github", {
        tools: [makeTool("create_issue_for_project")],
        toolParentNames: { create_issue_for_project: "create_issue" },
      });

      expect(resolver.activeTools.size).toBe(0);
    });
  });

  describe("internal kind bypasses catalog", () => {
    it("internal tools are visible even with strict catalog and no approvals", () => {
      ({ registry, catalog, resolver } = setup({
        isStrict: true,
        approvals: new Map(),
      }));

      registry.registerServer("mcpx", {
        tools: [makeTool("get_new_capabilities", "internal")],
      });

      expect(resolver.activeTools.size).toBe(1);
    });

    it("does not affect upstream-kind tools on other servers", () => {
      ({ registry, catalog, resolver } = setup({
        isStrict: true,
        approvals: new Map(),
      }));

      registry.registerServer("mcpx", {
        tools: [makeTool("internal_tool", "internal")],
      });
      registry.registerServer("github", { tools: [makeTool("create_issue")] });

      expect(resolver.activeTools.size).toBe(1);
      expect(
        resolver.activeTools.has(`mcpx${SERVICE_DELIMITER}internal_tool`),
      ).toBe(true);
    });
  });

  describe("inactive suppression", () => {
    it("suppresses tools from inactive server", () => {
      registry.registerServer("github", { tools: [makeTool("a")] });
      resolver.setInactiveServers(new Set(["github"]));

      expect(resolver.activeTools.size).toBe(0);
    });

    it("restores tools when server becomes active again", () => {
      registry.registerServer("github", { tools: [makeTool("a")] });
      resolver.setInactiveServers(new Set(["github"]));
      resolver.setInactiveServers(new Set());

      expect(resolver.activeTools.size).toBe(1);
    });

    it("setInactiveServers before registerServer still suppresses", () => {
      resolver.setInactiveServers(new Set(["github"]));
      registry.registerServer("github", { tools: [makeTool("a")] });

      expect(resolver.activeTools.size).toBe(0);
    });

    it("setInactiveServers is a no-op when set is unchanged", () => {
      registry.registerServer("github", { tools: [makeTool("a")] });
      resolver.setInactiveServers(new Set(["github"]));
      const cb = jest.fn<(kind: CapabilityKind) => void>();
      resolver.onChanged(cb);

      resolver.setInactiveServers(new Set(["github"]));
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("reactivity", () => {
    it("notifies only the kinds whose set actually changed", () => {
      const cb = jest.fn<(kind: CapabilityKind) => void>();
      resolver.onChanged(cb);

      registry.registerServer("github", { tools: [makeTool("a")] });
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith("tools");
    });

    it("does NOT recompute on a catalog no-op push", () => {
      // setCatalog with no real change emits an all-empty CatalogChange.
      // The resolver should skip recompute (and the resulting notify).
      registry.registerServer("github", { tools: [makeTool("a")] });
      const cb = jest.fn<(kind: CapabilityKind) => void>();
      resolver.onChanged(cb);

      catalog._notify();
      expect(cb).not.toHaveBeenCalled();
    });

    it("notifies when a catalog change actually changes approvals", () => {
      const approvals = new Map<string, string[] | null>([
        ["github", ["create_issue"]],
      ]);
      ({ registry, catalog, resolver } = setup({
        isStrict: true,
        approvals,
      }));
      registry.registerServer("github", {
        tools: [makeTool("create_issue"), makeTool("list_issues")],
      });
      const cb = jest.fn<(kind: CapabilityKind) => void>();
      resolver.onChanged(cb);

      approvals.set("github", ["create_issue", "list_issues"]);
      catalog._notify({
        ...NOOP_CHANGE,
        approvedToolsChanges: [
          {
            serverName: "github",
            addedTools: ["list_issues"],
            removedTools: [],
          },
        ],
      });
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith("tools");
    });
  });

  describe("getApprovedToolsForServer", () => {
    it("returns unprefixed tools for a specific server", () => {
      registry.registerServer("github", {
        tools: [makeTool("create_issue"), makeTool("list_issues")],
      });

      const tools = resolver.getApprovedToolsForServer("github");
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain("create_issue");
      expect(tools.map((t) => t.name)).toContain("list_issues");
    });

    it("returns empty array for unknown server", () => {
      expect(resolver.getApprovedToolsForServer("unknown")).toEqual([]);
    });

    it("excludes denied tools in strict mode", () => {
      const approvals = new Map<string, string[] | null>([
        ["github", ["create_issue"]],
      ]);
      ({ registry, catalog, resolver } = setup({ isStrict: true, approvals }));

      registry.registerServer("github", {
        tools: [makeTool("create_issue"), makeTool("blocked")],
      });

      const tools = resolver.getApprovedToolsForServer("github");
      expect(tools).toHaveLength(1);
      expect(tools[0]?.name).toBe("create_issue");
    });

    it("is consistent with activeTools immediately after registerServer", () => {
      registry.registerServer("github", { tools: [makeTool("a")] });
      const tools = resolver.getApprovedToolsForServer("github");
      expect(tools).toHaveLength(1);
    });
  });

  describe("per-consumer permission filtering", () => {
    it("getVisibleTools applies permission filter on top of active set", () => {
      const denied = new Set(["github__delete_issue"]);
      const permissions = makePermissions(
        ({ serviceName, capabilityName }) =>
          !denied.has(`${serviceName}__${capabilityName}`),
      );
      ({ registry, catalog, resolver } = setup(
        { isStrict: false, approvals: new Map() },
        permissions,
      ));

      registry.registerServer("github", {
        tools: [makeTool("create_issue"), makeTool("delete_issue")],
      });

      const visible = resolver.getVisibleTools({
        consumerTag: "alice",
        clientName: "claude",
      });
      const names = visible.map((c) => c.capabilityName);
      expect(names).toEqual(["create_issue"]);
    });

    it("getVisibleTools sorts deterministically by serverName then capabilityName", () => {
      registry.registerServer("slack", {
        tools: [makeTool("z_tool"), makeTool("a_tool")],
      });
      registry.registerServer("github", { tools: [makeTool("b_tool")] });

      const visible = resolver.getVisibleTools({});
      expect(visible.map((c) => `${c.serverName}/${c.capabilityName}`)).toEqual(
        ["github/b_tool", "slack/a_tool", "slack/z_tool"],
      );
    });

    it("internal-origin tools bypass the permission gate in getVisibleTools", () => {
      // Consumer that denies every tool through the PermissionManager.
      const permissions = makePermissions(() => false);
      ({ registry, catalog, resolver } = setup(
        { isStrict: false, approvals: new Map() },
        permissions,
      ));
      // An OAuth server registers its upstream tool + an internal auth tool.
      registry.registerServer("github", {
        tools: [
          makeTool("create_issue", "upstream"),
          makeTool("request_authentication_link", "internal"),
        ],
      });

      const visible = resolver.getVisibleTools({ consumerTag: "alice" });
      const names = visible.map((c) => c.capabilityName);
      expect(names).toEqual(["request_authentication_link"]);
    });

    it("resolveToolCall returns ok for internal-origin tools even when permissions deny", () => {
      const permissions = makePermissions(() => false);
      ({ registry, catalog, resolver } = setup(
        { isStrict: false, approvals: new Map() },
        permissions,
      ));
      registry.registerServer("github", {
        tools: [makeTool("request_authentication_link", "internal")],
      });

      const result = resolver.resolveToolCall(
        `github${SERVICE_DELIMITER}request_authentication_link`,
        { consumerTag: "alice" },
      );
      expect(result.ok).toBe(true);
    });

    it("resolveToolCall still rejects upstream tools when permissions deny", () => {
      const permissions = makePermissions(() => false);
      ({ registry, catalog, resolver } = setup(
        { isStrict: false, approvals: new Map() },
        permissions,
      ));
      registry.registerServer("github", {
        tools: [makeTool("create_issue", "upstream")],
      });

      const result = resolver.resolveToolCall(
        `github${SERVICE_DELIMITER}create_issue`,
        { consumerTag: "alice" },
      );
      expect(result).toEqual({ ok: false, reason: "permission-denied" });
    });

    it("passes consumerTag and clientName through to the permission check", () => {
      const seen: Array<{
        capabilityKind: CapabilityKind;
        serviceName: string;
        capabilityName: string;
        consumerTag?: string;
        clientName?: string;
      }> = [];
      ({ registry, catalog, resolver } = setup(
        { isStrict: false, approvals: new Map() },
        {
          hasPermission: (props) => {
            seen.push(props);
            return true;
          },
        },
      ));
      registry.registerServer("github", { tools: [makeTool("create_issue")] });

      resolver.getVisibleTools({
        consumerTag: "alice",
        clientName: "claude",
      });
      expect(seen[0]).toEqual({
        capabilityKind: "tools",
        serviceName: "github",
        capabilityName: "create_issue",
        consumerTag: "alice",
        clientName: "claude",
      });
    });
  });

  describe("resolveToolCall", () => {
    it("returns the entry for a registered approved tool", () => {
      registry.registerServer("github", { tools: [makeTool("create_issue")] });
      const result = resolver.resolveToolCall(
        `github${SERVICE_DELIMITER}create_issue`,
        {},
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entry.serverName).toBe("github");
        expect(result.entry.capabilityName).toBe("create_issue");
      }
    });

    it("returns reason 'unknown' for a name that doesn't resolve", () => {
      expect(resolver.resolveToolCall("ghost__missing", {})).toEqual({
        ok: false,
        reason: "unknown",
      });
    });

    it("returns reason 'unknown' for a malformed name (no delimiter)", () => {
      expect(resolver.resolveToolCall("no-delimiter", {})).toEqual({
        ok: false,
        reason: "unknown",
      });
    });

    it("returns reason 'server-inactive' when the server is registered but suppressed", () => {
      registry.registerServer("github", { tools: [makeTool("create_issue")] });
      resolver.setInactiveServers(new Set(["github"]));

      expect(
        resolver.resolveToolCall(`github${SERVICE_DELIMITER}create_issue`, {}),
      ).toEqual({ ok: false, reason: "server-inactive" });
    });

    it("returns reason 'permission-denied' when the consumer cannot use it", () => {
      ({ registry, catalog, resolver } = setup(
        { isStrict: false, approvals: new Map() },
        makePermissions(() => false),
      ));
      registry.registerServer("github", { tools: [makeTool("create_issue")] });

      expect(
        resolver.resolveToolCall(`github${SERVICE_DELIMITER}create_issue`, {
          consumerTag: "alice",
        }),
      ).toEqual({ ok: false, reason: "permission-denied" });
    });
  });

  describe("shutdown", () => {
    it("stops reacting to registry changes after shutdown", () => {
      const cb = jest.fn<(kind: CapabilityKind) => void>();
      resolver.onChanged(cb);
      resolver.shutdown();

      registry.registerServer("github", { tools: [makeTool("a")] });
      expect(cb).not.toHaveBeenCalled();
    });

    it("stops reacting to catalog changes after shutdown", () => {
      const cb = jest.fn<(kind: CapabilityKind) => void>();
      resolver.onChanged(cb);
      resolver.shutdown();

      catalog._notify({ ...NOOP_CHANGE, strictnessChanged: true });
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("prompts", () => {
    it("registers upstream prompts as active when non-strict", () => {
      registry.registerServer("notion", { prompts: [makePrompt("summarize")] });
      const active = Array.from(resolver.activePrompts.values());
      expect(active).toHaveLength(1);
      expect(active[0]?.serverName).toBe("notion");
      expect(active[0]?.capabilityName).toBe("summarize");
      expect(active[0]?.definition.name).toBe(
        `notion${SERVICE_DELIMITER}summarize`,
      );
    });

    it("filters unapproved upstream prompts in strict mode", () => {
      ({ registry, catalog, resolver } = setup({
        isStrict: true,
        approvals: new Map([["notion", ["summarize"]]]),
      }));
      registry.registerServer("notion", {
        prompts: [makePrompt("summarize"), makePrompt("delete-page")],
      });
      const names = Array.from(resolver.activePrompts.values()).map(
        (c) => c.capabilityName,
      );
      expect(names).toEqual(["summarize"]);
    });

    it("getVisiblePrompts passes capabilityKind='prompts' to permission check", () => {
      const seen: CapabilityKind[] = [];
      ({ registry, catalog, resolver } = setup(
        { isStrict: false, approvals: new Map() },
        makePermissions((props) => {
          seen.push(props.capabilityKind);
          return true;
        }),
      ));
      registry.registerServer("notion", { prompts: [makePrompt("summarize")] });
      resolver.getVisiblePrompts({});
      expect(seen).toContain("prompts");
      expect(seen).not.toContain("tools");
    });

    describe("resolvePromptGet", () => {
      it("returns the entry for a registered approved prompt", () => {
        registry.registerServer("notion", {
          prompts: [makePrompt("summarize")],
        });
        const result = resolver.resolvePromptGet(
          `notion${SERVICE_DELIMITER}summarize`,
          {},
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.entry.serverName).toBe("notion");
          expect(result.entry.capabilityName).toBe("summarize");
        }
      });

      it("returns reason 'unknown' for a name that doesn't resolve", () => {
        const result = resolver.resolvePromptGet("does-not-exist", {});
        expect(result).toEqual({ ok: false, reason: "unknown" });
      });

      it("returns reason 'server-inactive' for an inactive server", () => {
        registry.registerServer("notion", {
          prompts: [makePrompt("summarize")],
        });
        resolver.setInactiveServers(new Set(["notion"]));
        const result = resolver.resolvePromptGet(
          `notion${SERVICE_DELIMITER}summarize`,
          {},
        );
        expect(result).toEqual({ ok: false, reason: "server-inactive" });
      });

      it("returns reason 'permission-denied' when the consumer is blocked", () => {
        ({ registry, catalog, resolver } = setup(
          { isStrict: false, approvals: new Map() },
          makePermissions(() => false),
        ));
        registry.registerServer("notion", {
          prompts: [makePrompt("summarize")],
        });
        const result = resolver.resolvePromptGet(
          `notion${SERVICE_DELIMITER}summarize`,
          { consumerTag: "alice" },
        );
        expect(result).toEqual({ ok: false, reason: "permission-denied" });
      });
    });

    describe("notify reactivity", () => {
      it("notifies only 'prompts' when a server registers prompts but no tools", () => {
        const cb = jest.fn<(kind: CapabilityKind) => void>();
        resolver.onChanged(cb);
        registry.registerServer("notion", {
          prompts: [makePrompt("summarize")],
        });
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith("prompts");
      });

      it("fires on same-name prompt definition change (content-aware diff)", () => {
        registry.registerServer("notion", {
          prompts: [makePrompt("summarize")],
        });
        const cb = jest.fn<(kind: CapabilityKind) => void>();
        resolver.onChanged(cb);
        // Re-register with same name, new description content.
        registry.registerServer("notion", {
          prompts: [
            {
              definition: { name: "summarize", description: "UPDATED" },
              origin: "upstream",
            },
          ],
        });
        expect(cb).toHaveBeenCalledWith("prompts");
      });

      it("doesn't fire on structurally identical re-registration", () => {
        registry.registerServer("notion", {
          prompts: [makePrompt("summarize")],
        });
        const cb = jest.fn<(kind: CapabilityKind) => void>();
        resolver.onChanged(cb);
        registry.registerServer("notion", {
          prompts: [makePrompt("summarize")],
        });
        expect(cb).not.toHaveBeenCalled();
      });
    });
  });
});
