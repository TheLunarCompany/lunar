import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { SetupManager } from "./setup-manager.js";
import { TargetServer } from "../model/target-servers.js";
import { Config } from "../model/config/config.js";
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

const baseConfig: Config = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
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
