import { DEFAULT_CONFIG } from "./config.js";
import { Config } from "./model.js";
import { PermissionManager } from "./permissions.js";

describe("PermissionManager#hasPermission", () => {
  describe("when not initialized", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "allow",
        consumers: {},
      },
      toolGroups: [],
    };
    const permissionManager = new PermissionManager(config);
    it("throws an error", () => {
      expect(() =>
        permissionManager.hasPermission({
          serviceName: "what",
          toolName: "ever",
          consumerTag: "duh",
        }),
      ).toThrow();
    });
  });
  describe("when all is blocked", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "block",
        consumers: {},
      },
      toolGroups: [],
    };

    const permissionManager = new PermissionManager(config);
    permissionManager.initialize();

    it("returns false", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "what",
          toolName: "ever",
          consumerTag: "duh",
        }),
      ).toBe(false);
    });
  });

  describe("when all is allowed", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "allow",
        consumers: {},
      },
      toolGroups: [],
    };

    const permissionManager = new PermissionManager(config);
    permissionManager.initialize();

    it("returns true", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "what",
          toolName: "ever",
          consumerTag: "duh",
        }),
      ).toBe(true);
    });
  });

  describe("when a consumer is allowed", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "block",
        consumers: {
          developers: {
            base: "allow",
          },
        },
      },
      toolGroups: [],
    };

    const permissionManager = new PermissionManager(config);
    permissionManager.initialize();

    it("returns true", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "what",
          toolName: "ever",
          consumerTag: "developers",
        }),
      ).toBe(true);
    });
  });

  describe("when a consumer is blocked", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "allow",
        consumers: {
          developers: {
            base: "block",
          },
        },
      },
      toolGroups: [],
    };

    const permissionManager = new PermissionManager(config);
    permissionManager.initialize();

    it("returns false", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "what",
          toolName: "ever",
          consumerTag: "developers",
        }),
      ).toBe(false);
    });
  });

  describe("when a consumer is allowed via profile", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "block",
        consumers: {
          developers: {
            base: "block",
            profiles: {
              allow: ["read"],
            },
          },
        },
      },
      toolGroups: [
        { name: "read", services: { slack: ["read-message"] } },
        { name: "write", services: { slack: ["send-message"] } },
      ],
    };

    const permissionManager = new PermissionManager(config);
    permissionManager.initialize();

    it("returns true for tool included in allowed profile", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "read-message",
          consumerTag: "developers",
        }),
      ).toBe(true);
    });

    it("returns false for tool from another profile not included in allowed profiles", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "send-message",
          consumerTag: "developers",
        }),
      ).toBe(false);
    });

    it("returns false for any other tool", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "another-tool",
          consumerTag: "developers",
        }),
      ).toBe(false);
    });

    it("returns false for any other service", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "another-service",
          toolName: "another-tool",
          consumerTag: "developers",
        }),
      ).toBe(false);
    });

    it("returns false for any other consumer", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "read-message",
          consumerTag: "another-consumer",
        }),
      ).toBe(false);
    });
  });

  describe("when a consumer is blocked via profile", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "allow",
        consumers: {
          developers: {
            base: "allow",
            profiles: {
              block: ["write"],
            },
          },
        },
      },
      toolGroups: [
        { name: "read", services: { slack: ["read-message"] } },
        { name: "write", services: { slack: ["send-message"] } },
      ],
    };

    const permissionManager = new PermissionManager(config);
    permissionManager.initialize();

    it("returns true for any not-blocked tool", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "read-message",
          consumerTag: "developers",
        }),
      ).toBe(true);
    });

    it("returns false for blocked tool", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "send-message",
          consumerTag: "developers",
        }),
      ).toBe(false);
    });

    it("returns true for any other tool not mentioned", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "another-tool",
          consumerTag: "developers",
        }),
      ).toBe(true);
    });

    it("returns true for any other service", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "another-service",
          toolName: "another-tool",
          consumerTag: "developers",
        }),
      ).toBe(true);
    });

    it("returns true for any other consumer", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "read-message",
          consumerTag: "another-consumer",
        }),
      ).toBe(true);
    });
  });

  describe("when a consumer is allowed all", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "block",
        consumers: {
          developers: {
            base: "block",
            profiles: {
              allow: ["all-slack"],
            },
          },
        },
      },
      toolGroups: [{ name: "all-slack", services: { slack: "*" } }],
    };

    const permissionManager = new PermissionManager(config);
    permissionManager.initialize();

    it("returns true for any tool from allowed profile", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "whatever-tool",
          consumerTag: "developers",
        }),
      ).toBe(true);
    });

    it("returns false for any other tool from another service", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "another-service",
          toolName: "whatever-tool",
          consumerTag: "developers",
        }),
      ).toBe(false);
    });

    it("returns false for any other tool from another consumer", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "whatever-tool",
          consumerTag: "another-consumer",
        }),
      ).toBe(false);
    });
  });

  describe("when a consumer is blocked all", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        base: "allow",
        consumers: {
          developers: {
            base: "allow",
            profiles: {
              block: ["all-slack"],
            },
          },
        },
      },
      toolGroups: [{ name: "all-slack", services: { slack: "*" } }],
    };

    const permissionManager = new PermissionManager(config);
    permissionManager.initialize();

    it("returns false for any tool from blocked profile", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "whatever-tool",
          consumerTag: "developers",
        }),
      ).toBe(false);
    });

    it("returns true for any other tool from another service", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "another-service",
          toolName: "whatever-tool",
          consumerTag: "developers",
        }),
      ).toBe(true);
    });

    it("returns true for any other tool from another consumer", () => {
      expect(
        permissionManager.hasPermission({
          serviceName: "slack",
          toolName: "whatever-tool",
          consumerTag: "another-consumer",
        }),
      ).toBe(true);
    });
  });
});
