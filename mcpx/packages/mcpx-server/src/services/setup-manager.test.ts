import { noOpLogger } from "@mcpx/toolkit-core/logging";
import {
  diffTargetServers,
  sanitizeIncomingConfig,
  SetupManager,
} from "./setup-manager.js";
import { TargetServer } from "../model/target-servers.js";
import { Config } from "../model/config/config.js";
import { StaticOAuth } from "@mcpx/shared-model";
import { ConfigService } from "../config.js";
import { UpstreamHandler } from "./upstream-handler.js";

// Minimal stubs - these methods don't use the dependencies
const stubTargetClients = {} as UpstreamHandler;
const stubConfigService = {} as ConfigService;

function createSetupManager(): SetupManager {
  return new SetupManager(stubTargetClients, stubConfigService, noOpLogger);
}

const echoServer: TargetServer = {
  type: "stdio",
  name: "echo-service",
  command: "node",
  args: ["echo.js"],
  env: {},
};

const calculatorServer: TargetServer = {
  type: "stdio",
  name: "calculator-service",
  command: "node",
  args: ["calc.js"],
  env: {},
};

const notionServer: TargetServer = {
  type: "streamable-http",
  name: "notion",
  url: "https://mcp.notion.com",
};

// Static OAuth mapping the notion host to a client-credentials provider.
// `key` lets tests rename the provider key while keeping the config identical.
function notionStaticOauth(
  scopes: string[],
  key = "notion",
): NonNullable<StaticOAuth> {
  return {
    mapping: { "mcp.notion.com": key },
    providers: {
      [key]: {
        authMethod: "client_credentials",
        credentials: {
          clientId: { type: "literal", value: "client-1" },
          clientSecret: { type: "literal", value: "secret-1" },
        },
        scopes,
        tokenAuthMethod: "client_secret_basic",
      },
    },
  };
}

const baseConfig: Config = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
    clientNames: {},
  },
  toolGroups: [],
  auth: { enabled: false },
  toolExtensions: { services: {} },
  targetServerAttributes: {},
};

describe("SetupManager", () => {
  describe("#buildUserTargetServersChangePayload", () => {
    it("returns payload on first call (no previous state)", () => {
      const manager = createSetupManager();

      const result = manager.buildUserTargetServersChangePayload([echoServer]);

      expect(result).not.toBeNull();
      expect(result?.source).toBe("user");
      expect(result?.targetServers).toHaveProperty("echo-service");
    });

    it("returns null when called with empty array (matches initial state)", () => {
      const manager = createSetupManager();

      const result = manager.buildUserTargetServersChangePayload([]);

      expect(result).toBeNull();
    });

    it("returns null when servers unchanged", () => {
      const manager = createSetupManager();

      // First call sets state
      manager.buildUserTargetServersChangePayload([echoServer]);

      // Second call with same servers
      const result = manager.buildUserTargetServersChangePayload([echoServer]);

      expect(result).toBeNull();
    });

    it("returns payload when servers change", () => {
      const manager = createSetupManager();

      // First call
      manager.buildUserTargetServersChangePayload([echoServer]);

      // Second call with different servers
      const result = manager.buildUserTargetServersChangePayload([
        echoServer,
        calculatorServer,
      ]);

      expect(result).not.toBeNull();
      expect(result?.source).toBe("user");
      expect(result?.targetServers).toHaveProperty("echo-service");
      expect(result?.targetServers).toHaveProperty("calculator-service");
    });

    it("returns payload when server removed", () => {
      const manager = createSetupManager();

      // First call with two servers
      manager.buildUserTargetServersChangePayload([
        echoServer,
        calculatorServer,
      ]);

      // Second call with one server removed
      const result = manager.buildUserTargetServersChangePayload([echoServer]);

      expect(result).not.toBeNull();
      expect(result?.targetServers).toHaveProperty("echo-service");
      expect(result?.targetServers).not.toHaveProperty("calculator-service");
    });
  });

  describe("#buildUserConfigChangePayload", () => {
    it("returns payload on first call (no previous state)", () => {
      const manager = createSetupManager();

      const result = manager.buildUserConfigChangePayload(baseConfig);

      expect(result).not.toBeNull();
      expect(result?.source).toBe("user");
      expect(result?.config).toBeDefined();
    });

    it("returns null when config unchanged", () => {
      const manager = createSetupManager();

      // First call sets state
      manager.buildUserConfigChangePayload(baseConfig);

      // Second call with same config
      const result = manager.buildUserConfigChangePayload(baseConfig);

      expect(result).toBeNull();
    });

    it("returns payload when config changes", () => {
      const manager = createSetupManager();

      // First call
      manager.buildUserConfigChangePayload(baseConfig);

      // Second call with different config
      const changedConfig: Config = {
        ...baseConfig,
        auth: { enabled: true },
      };
      const result = manager.buildUserConfigChangePayload(changedConfig);

      expect(result).not.toBeNull();
      expect(result?.source).toBe("user");
      expect(result?.config?.auth).toEqual({ enabled: true });
    });

    it("returns payload when toolGroups change", () => {
      const manager = createSetupManager();

      // First call
      manager.buildUserConfigChangePayload(baseConfig);

      // Second call with toolGroups
      const configWithToolGroups: Config = {
        ...baseConfig,
        toolGroups: [{ name: "test-group", services: {} }],
      };
      const result = manager.buildUserConfigChangePayload(configWithToolGroups);

      expect(result).not.toBeNull();
      expect(result?.config?.toolGroups).toHaveLength(1);
    });
  });

  describe("state consistency", () => {
    it("preserves config when only servers change", () => {
      const manager = createSetupManager();

      // Set config first
      manager.buildUserConfigChangePayload(baseConfig);

      // Then change servers
      const result = manager.buildUserTargetServersChangePayload([echoServer]);

      expect(result).not.toBeNull();
      expect(result?.config).toBeDefined();
      expect(result?.targetServers).toHaveProperty("echo-service");
    });

    it("preserves servers when only config changes", () => {
      const manager = createSetupManager();

      // Set servers first
      manager.buildUserTargetServersChangePayload([echoServer]);

      // Then change config
      const changedConfig: Config = { ...baseConfig, auth: { enabled: true } };
      const result = manager.buildUserConfigChangePayload(changedConfig);

      expect(result).not.toBeNull();
      expect(result?.targetServers).toHaveProperty("echo-service");
      expect(result?.config?.auth).toEqual({ enabled: true });
    });
  });

  describe("tool group owner filtering", () => {
    it("excludes dynamic-capabilities groups from outbound payload", () => {
      const manager = createSetupManager();

      const configWithMixedGroups: Config = {
        ...baseConfig,
        toolGroups: [
          { name: "user-group", services: { slack: ["post"] } },
          { name: "user-group-explicit", services: {}, owner: "user" },
          {
            name: "dynamic-group",
            services: { mcpx: "*" },
            owner: "dynamic-capabilities",
          },
        ],
      };

      const result = manager.buildUserConfigChangePayload(
        configWithMixedGroups,
      );

      expect(result).not.toBeNull();
      expect(result?.config?.toolGroups).toHaveLength(2);
      expect(result?.config?.toolGroups?.map((g) => g.name)).toEqual([
        "user-group",
        "user-group-explicit",
      ]);
    });

    it("treats groups without owner field as user-created", () => {
      const manager = createSetupManager();

      // This simulates what happens when config comes from hub (no owner field)
      const configFromHub: Config = {
        ...baseConfig,
        toolGroups: [
          { name: "hub-group", services: { github: ["create_pr"] } },
        ],
      };

      const result = manager.buildUserConfigChangePayload(configFromHub);

      expect(result).not.toBeNull();
      expect(result?.config?.toolGroups).toHaveLength(1);
      expect(result?.config?.toolGroups?.[0]?.name).toBe("hub-group");
    });
  });
});

describe("diffTargetServers", () => {
  it("returns empty diff when nothing changed", () => {
    const { toAdd, toRemove } = diffTargetServers({
      current: [echoServer, notionServer],
      incoming: [echoServer, notionServer],
    });

    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it("leaves an unchanged server untouched when another is added", () => {
    // Re-applying must not drop a server that didn't change.
    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer],
      incoming: [notionServer, echoServer],
    });

    expect(toAdd).toEqual([echoServer]);
    expect(toRemove).toEqual([]);
  });

  it("removes only servers gone from the incoming list", () => {
    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer, calculatorServer],
      incoming: [notionServer],
    });

    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([calculatorServer]);
  });

  it("recreates a server whose config changed (re-auth on new endpoint)", () => {
    const movedNotion: TargetServer = {
      ...notionServer,
      url: "https://mcp.notion.so",
    };

    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer],
      incoming: [movedNotion],
    });

    expect(toAdd).toEqual([movedNotion]);
    expect(toRemove).toEqual([notionServer]);
  });

  it("matches names case-insensitively", () => {
    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer],
      incoming: [{ ...notionServer, name: "Notion" }],
    });

    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it("reconnects a server whose static-OAuth scopes changed", () => {
    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer],
      incoming: [notionServer],
      currentStaticOauth: notionStaticOauth(["read"]),
      incomingStaticOauth: notionStaticOauth(["read", "write"]),
    });

    expect(toAdd).toEqual([notionServer]);
    expect(toRemove).toEqual([notionServer]);
  });

  it("leaves a server alone when its static OAuth is unchanged", () => {
    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer],
      incoming: [notionServer],
      currentStaticOauth: notionStaticOauth(["read"]),
      incomingStaticOauth: notionStaticOauth(["read"]),
    });

    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it("reconnects when static OAuth is dropped", () => {
    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer],
      incoming: [notionServer],
      currentStaticOauth: notionStaticOauth(["read"]),
      incomingStaticOauth: undefined,
    });

    expect(toAdd).toEqual([notionServer]);
    expect(toRemove).toEqual([notionServer]);
  });

  it("does not reconnect when only the provider key is renamed but config is identical", () => {
    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer],
      incoming: [notionServer],
      currentStaticOauth: notionStaticOauth(["read"], "notion"),
      incomingStaticOauth: notionStaticOauth(["read"], "notion-renamed"),
    });

    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it("ignores key ordering when comparing provider config", () => {
    const reordered = notionStaticOauth(["read"]);
    // Rebuild the provider object with keys in reverse insertion order.
    reordered.providers["notion"] = {
      tokenAuthMethod: "client_secret_basic",
      scopes: ["read"],
      credentials: {
        clientSecret: { value: "secret-1", type: "literal" },
        clientId: { value: "client-1", type: "literal" },
      },
      authMethod: "client_credentials",
    };

    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer],
      incoming: [notionServer],
      currentStaticOauth: notionStaticOauth(["read"]),
      incomingStaticOauth: reordered,
    });

    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it("ignores static OAuth for stdio servers", () => {
    // echoServer is stdio (no URL), so static OAuth can never apply to it.
    const { toAdd, toRemove } = diffTargetServers({
      current: [echoServer],
      incoming: [echoServer],
      currentStaticOauth: notionStaticOauth(["read"]),
      incomingStaticOauth: notionStaticOauth(["read", "write"]),
    });

    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it("an OAuth change on one server doesn't drag an unchanged server into the diff", () => {
    const { toAdd, toRemove } = diffTargetServers({
      current: [notionServer, echoServer],
      incoming: [notionServer, echoServer],
      currentStaticOauth: notionStaticOauth(["read"]),
      incomingStaticOauth: notionStaticOauth(["read", "write"]),
    });

    expect(toAdd).toEqual([notionServer]);
    expect(toRemove).toEqual([notionServer]);
  });

  it("tolerates a static OAuth object missing its mapping", () => {
    // resolveProviderKey would throw on a missing mapping; the diff must not.
    const malformed = { providers: {} } as unknown as StaticOAuth;
    expect(() =>
      diffTargetServers({
        current: [notionServer],
        incoming: [notionServer],
        currentStaticOauth: malformed,
        incomingStaticOauth: malformed,
      }),
    ).not.toThrow();
  });
});

describe("sanitizeIncomingConfig", () => {
  describe("fills in defaults", () => {
    it("fills in empty permissions when not provided", () => {
      const result = sanitizeIncomingConfig({});

      expect(result.permissions).toEqual({
        default: { _type: "default-allow", block: [] },
        consumers: {},
        clientNames: {},
      });
    });

    it("fills in empty toolGroups when not provided", () => {
      const result = sanitizeIncomingConfig({});

      expect(result.toolGroups).toEqual([]);
    });

    it("fills in auth disabled when not provided", () => {
      const result = sanitizeIncomingConfig({});

      expect(result.auth).toEqual({ enabled: false });
    });
  });

  describe("drops stale consumer permissions", () => {
    it("drops consumer with allow referencing non-existent tool group", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [],
        permissions: {
          default: { _type: "default-allow", block: [] },
          consumers: {
            Cursor: { _type: "default-block", allow: ["Cursor_dynamic"] },
          },
          clientNames: {},
        },
      });

      expect(result.permissions.consumers).toEqual({});
    });

    it("keeps consumer with allow referencing existing tool group", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [{ name: "my-group", services: {} }],
        permissions: {
          default: { _type: "default-allow", block: [] },
          consumers: {
            Cursor: { _type: "default-block", allow: ["my-group"] },
          },
          clientNames: {},
        },
      });

      expect(result.permissions.consumers).toEqual({
        Cursor: { _type: "default-block", allow: ["my-group"] },
      });
    });

    it("drops consumer with block referencing non-existent tool group", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [],
        permissions: {
          default: { _type: "default-allow", block: [] },
          consumers: {
            Agent: { _type: "default-allow", block: ["stale-group"] },
          },
          clientNames: {},
        },
      });

      expect(result.permissions.consumers).toEqual({});
    });

    it("keeps consumer with empty allow array", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [],
        permissions: {
          default: { _type: "default-allow", block: [] },
          consumers: {
            Cursor: { _type: "default-block", allow: [] },
          },
          clientNames: {},
        },
      });

      expect(result.permissions.consumers).toEqual({
        Cursor: { _type: "default-block", allow: [] },
      });
    });

    it("drops consumer if any reference in allow is stale", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [{ name: "valid-group", services: {} }],
        permissions: {
          default: { _type: "default-allow", block: [] },
          consumers: {
            Cursor: {
              _type: "default-block",
              allow: ["valid-group", "stale-group"],
            },
          },
          clientNames: {},
        },
      });

      expect(result.permissions.consumers).toEqual({});
    });

    it("drops only the bad consumer, keeps valid ones", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [{ name: "valid-group", services: {} }],
        permissions: {
          default: { _type: "default-allow", block: [] },
          consumers: {
            Cursor: { _type: "default-block", allow: ["stale-group"] },
            Claude: { _type: "default-block", allow: ["valid-group"] },
            Windsurf: { _type: "default-allow", block: [] },
          },
          clientNames: {},
        },
      });

      expect(result.permissions.consumers).toEqual({
        Claude: { _type: "default-block", allow: ["valid-group"] },
        Windsurf: { _type: "default-allow", block: [] },
      });
    });
  });

  describe("resets stale default permission", () => {
    it("resets default to block:[] when allow references non-existent group", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [],
        permissions: {
          default: { _type: "default-block", allow: ["stale-group"] },
          consumers: {},
          clientNames: {},
        },
      });

      expect(result.permissions.default).toEqual({
        _type: "default-allow",
        block: [],
      });
    });

    it("resets default to block:[] when block references non-existent group", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [],
        permissions: {
          default: { _type: "default-allow", block: ["stale-group"] },
          consumers: {},
          clientNames: {},
        },
      });

      expect(result.permissions.default).toEqual({
        _type: "default-allow",
        block: [],
      });
    });

    it("keeps default when references are valid", () => {
      const result = sanitizeIncomingConfig({
        toolGroups: [{ name: "my-group", services: {} }],
        permissions: {
          default: { _type: "default-block", allow: ["my-group"] },
          consumers: {},
          clientNames: {},
        },
      });

      expect(result.permissions.default).toEqual({
        _type: "default-block",
        allow: ["my-group"],
      });
    });
  });
});
