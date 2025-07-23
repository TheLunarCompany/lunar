import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { ConfigManager, DEFAULT_CONFIG } from "../config.js";
import { Config } from "../model/config/config.js";
import { PermissionManager } from "./permissions.js";

describe("PermissionManager#hasPermission", () => {
  describe("when not initialized", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      permissions: {
        default: {
          _type: "default-allow",
          block: [],
        },
        consumers: {},
      },
      toolGroups: [],
    };
    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
        default: {
          _type: "default-block",
          allow: [],
        },
        consumers: {},
      },
      toolGroups: [],
    };

    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
        default: {
          _type: "default-allow",
          block: [],
        },
        consumers: {},
      },
      toolGroups: [],
    };

    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
        default: {
          _type: "default-block",
          allow: [],
        },
        consumers: {
          developers: {
            _type: "default-allow",
            block: [],
          },
        },
      },
      toolGroups: [],
    };

    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
        default: {
          _type: "default-allow",
          block: [],
        },
        consumers: {
          developers: {
            _type: "default-block",
            allow: [],
          },
        },
      },
      toolGroups: [],
    };

    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
        default: {
          _type: "default-block",
          allow: [],
        },
        consumers: {
          developers: {
            _type: "default-block",
            allow: ["read"],
          },
        },
      },
      toolGroups: [
        { name: "read", services: { slack: ["read-message"] } },
        { name: "write", services: { slack: ["send-message"] } },
      ],
    };

    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
        default: {
          _type: "default-allow",
          block: [],
        },
        consumers: {
          developers: {
            _type: "default-allow",
            block: ["write"],
          },
        },
      },
      toolGroups: [
        { name: "read", services: { slack: ["read-message"] } },
        { name: "write", services: { slack: ["send-message"] } },
      ],
    };

    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
        default: {
          _type: "default-block",
          allow: [],
        },
        consumers: {
          developers: {
            _type: "default-block",
            allow: ["all-slack"],
          },
        },
      },
      toolGroups: [{ name: "all-slack", services: { slack: "*" } }],
    };

    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
        default: {
          _type: "default-allow",
          block: [],
        },
        consumers: {
          developers: {
            _type: "default-allow",
            block: ["all-slack"],
          },
        },
      },
      toolGroups: [{ name: "all-slack", services: { slack: "*" } }],
    };

    const permissionManager = new PermissionManager(
      new ConfigManager(config),
      noOpLogger,
    );
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
  describe("when applying multiple tool groups", () => {
    describe("merging allow and allow", () => {
      const config: Config = {
        ...DEFAULT_CONFIG,
        permissions: {
          default: {
            _type: "default-block",
            allow: [],
          },
          consumers: {
            developers: {
              _type: "default-block",
              allow: ["read", "write"],
            },
          },
        },
        toolGroups: [
          { name: "read", services: { slack: ["read-message"] } },
          {
            name: "write",
            services: { slack: ["read-message", "send-message"] },
          },
        ],
      };

      const permissionManager = new PermissionManager(
        new ConfigManager(config),
        noOpLogger,
      );
      permissionManager.initialize();
      it("returns true for all tools in both groups", () => {
        expect(
          permissionManager.hasPermission({
            serviceName: "slack",
            toolName: "read-message",
            consumerTag: "developers",
          }),
        ).toBe(true);
        expect(
          permissionManager.hasPermission({
            serviceName: "slack",
            toolName: "send-message",
            consumerTag: "developers",
          }),
        ).toBe(true);
      });
    });
    describe("merging block and block", () => {
      const config: Config = {
        ...DEFAULT_CONFIG,
        permissions: {
          default: {
            _type: "default-allow",
            block: [],
          },
          consumers: {
            developers: {
              _type: "default-allow",
              block: ["read", "write"],
            },
          },
        },
        toolGroups: [
          { name: "read", services: { slack: ["read-message"] } },
          { name: "write", services: { slack: ["send-message"] } },
        ],
      };

      const permissionManager = new PermissionManager(
        new ConfigManager(config),
        noOpLogger,
      );
      permissionManager.initialize();
      it("returns false for all tools in both groups", () => {
        expect(
          permissionManager.hasPermission({
            serviceName: "slack",
            toolName: "read-message",
            consumerTag: "developers",
          }),
        ).toBe(false);
        expect(
          permissionManager.hasPermission({
            serviceName: "slack",
            toolName: "send-message",
            consumerTag: "developers",
          }),
        ).toBe(false);
      });
    });
    describe("merging allow_all and allow", () => {
      const config: Config = {
        ...DEFAULT_CONFIG,
        permissions: {
          default: {
            _type: "default-block",
            allow: [],
          },
          consumers: {
            developers: {
              _type: "default-block",
              allow: ["all-slack", "basic-level"],
            },
          },
        },
        toolGroups: [
          {
            name: "basic-level",
            services: { slack: ["read-message"], linear: ["read-ticket"] },
          },
          { name: "all-slack", services: { slack: "*" } },
        ],
      };

      const permissionManager = new PermissionManager(
        new ConfigManager(config),
        noOpLogger,
      );
      permissionManager.initialize();
      it("returns true for all tools from the allow_all group", () => {
        expect(
          // Assert on the specified tool from the service that was also allow_all
          permissionManager.hasPermission({
            serviceName: "slack",
            toolName: "read-message",
            consumerTag: "developers",
          }),
        ).toBe(true);
        expect(
          // Assert on whatever tool from that service
          permissionManager.hasPermission({
            serviceName: "slack",
            toolName: "whatever-tool",
            consumerTag: "developers",
          }),
        ).toBe(true);
      });
      it("returns true for specific tools from the allow group", () => {
        expect(
          permissionManager.hasPermission({
            serviceName: "linear",
            toolName: "read-ticket",
            consumerTag: "developers",
          }),
        ).toBe(true);
      });
      it("returns false for any other tool", () => {
        expect(
          permissionManager.hasPermission({
            serviceName: "another-service",
            toolName: "another-tool",
            consumerTag: "developers",
          }),
        ).toBe(false);
      });
    });
    describe("merging block_all and block", () => {
      const config: Config = {
        ...DEFAULT_CONFIG,
        permissions: {
          default: {
            _type: "default-allow",
            block: [],
          },
          consumers: {
            developers: {
              _type: "default-allow",
              block: ["basic-level", "all-slack"],
            },
          },
        },
        toolGroups: [
          {
            name: "basic-level",
            services: { slack: ["read-message"], linear: ["read-ticket"] },
          },
          { name: "all-slack", services: { slack: "*" } },
        ],
      };

      const permissionManager = new PermissionManager(
        new ConfigManager(config),
        noOpLogger,
      );
      permissionManager.initialize();
      it("returns false for all tools from the block_all group", () => {
        expect(
          // Assert on the specified tool from the service that was also block_all
          permissionManager.hasPermission({
            serviceName: "slack",
            toolName: "read-message",
            consumerTag: "developers",
          }),
        ).toBe(false);
        expect(
          // Assert on whatever tool from that service
          permissionManager.hasPermission({
            serviceName: "slack",
            toolName: "whatever-tool",
            consumerTag: "developers",
          }),
        ).toBe(false);
      });
      it("returns false for specific tools from the block group", () => {
        expect(
          permissionManager.hasPermission({
            serviceName: "linear",
            toolName: "read-ticket",
            consumerTag: "developers",
          }),
        ).toBe(false);
      });
      it("returns true for any other tool", () => {
        expect(
          permissionManager.hasPermission({
            serviceName: "another-service",
            toolName: "another-tool",
            consumerTag: "developers",
          }),
        ).toBe(true);
      });
    });
  });
});
