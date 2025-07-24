import { parse } from "yaml";
import {
  appConfigSchema,
  nextVersionAppConfigSchema,
} from "@mcpx/shared-model";
import {
  convertToNextVersionConfig,
  convertToCurrentVersionConfig,
} from "./config-versioning.js";

// These tests didn't have to use YAML format, but since this is how we communicate around config
// in this project, we make the extra step to parse YAML into JS objects
// so examples here are actually what you can copy-paste into app.yaml.

describe("config-versioning", () => {
  describe("convertToNextVersionConfig (old → new format)", () => {
    describe("permissions", () => {
      it("should convert base allow to default-allow", () => {
        const oldYaml = `
permissions:
  base: allow
  consumers: {}
toolGroups: []
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(oldYaml);
        const oldConfig = appConfigSchema.parse(parsedYaml);
        const result = convertToNextVersionConfig(oldConfig);

        expect(result.permissions).toEqual({
          default: {
            _type: "default-allow",
            block: [],
          },
          consumers: {},
        });
      });

      it("should convert base block to default-block", () => {
        const oldYaml = `
permissions:
  base: block
  consumers: {}
toolGroups: []
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(oldYaml);
        const oldConfig = appConfigSchema.parse(parsedYaml);
        const result = convertToNextVersionConfig(oldConfig);

        expect(result.permissions).toEqual({
          default: {
            _type: "default-block",
            allow: [],
          },
          consumers: {},
        });
      });

      it("should convert consumers with profiles", () => {
        const oldYaml = `
permissions:
  base: block
  consumers:
    developers:
      base: allow
      consumerGroupKey: dev-group
      profiles:
        block:
          - admin-tools
    readers:
      base: block
      consumerGroupKey: ""
      profiles:
        allow:
          - read-tools
          - basic-tools
toolGroups:
  - name: admin-tools
    services:
      slack: ["admin-message"]
  - name: read-tools
    services:
      slack: ["read-message"]
  - name: basic-tools
    services:
      github: ["read-repo"]
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(oldYaml);
        const oldConfig = appConfigSchema.parse(parsedYaml);
        const result = convertToNextVersionConfig(oldConfig);

        expect(result.permissions).toEqual({
          default: {
            _type: "default-block",
            allow: [],
          },
          consumers: {
            developers: {
              _type: "default-allow",
              block: ["admin-tools"],
              consumerGroupKey: "dev-group",
            },
            readers: {
              _type: "default-block",
              allow: ["read-tools", "basic-tools"],
              consumerGroupKey: "",
            },
          },
        });
        expect(result.toolGroups).toHaveLength(3);
      });

      it("should handle empty profiles", () => {
        const oldYaml = `
permissions:
  base: allow
  consumers:
    dev:
      base: allow
      consumerGroupKey: ""
      profiles:
        block: []
    test:
      base: block
      consumerGroupKey: ""
      profiles:
        allow: []
toolGroups: []
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(oldYaml);
        const oldConfig = appConfigSchema.parse(parsedYaml);
        const result = convertToNextVersionConfig(oldConfig);

        expect(result.permissions.consumers["dev"]).toEqual({
          _type: "default-allow",
          block: [],
          consumerGroupKey: "",
        });
        expect(result.permissions.consumers["test"]).toEqual({
          _type: "default-block",
          allow: [],
          consumerGroupKey: "",
        });
      });

      it("should preserve auth and other fields", () => {
        const oldYaml = `
permissions:
  base: allow
  consumers: {}
toolGroups: []
auth:
  enabled: true
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(oldYaml);
        const oldConfig = appConfigSchema.parse(parsedYaml);
        const result = convertToNextVersionConfig(oldConfig);

        expect(result.auth).toEqual({ enabled: true });
      });

      it("should handle complex configuration with wildcards", () => {
        const oldYaml = `
permissions:
  base: block
  consumers:
    admin:
      base: allow
      consumerGroupKey: admin-group
      profiles:
        block:
          - dangerous
    developer:
      base: block
      consumerGroupKey: ""
      profiles:
        allow:
          - read
          - write
    viewer:
      base: allow
      consumerGroupKey: ""
      profiles:
        block: []
toolGroups:
  - name: dangerous
    services:
      system: "*"
  - name: read
    services:
      github: ["read-repo", "read-issues"]
      slack: ["read-message"]
  - name: write
    services:
      github: ["write-repo", "create-pr"]
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(oldYaml);
        const oldConfig = appConfigSchema.parse(parsedYaml);
        const result = convertToNextVersionConfig(oldConfig);

        expect(result.permissions).toEqual({
          default: {
            _type: "default-block",
            allow: [],
          },
          consumers: {
            admin: {
              _type: "default-allow",
              block: ["dangerous"],
              consumerGroupKey: "admin-group",
            },
            developer: {
              _type: "default-block",
              allow: ["read", "write"],
              consumerGroupKey: "",
            },
            viewer: {
              _type: "default-allow",
              block: [],
              consumerGroupKey: "",
            },
          },
        });
        expect(result.toolGroups[0]!.services["system"]).toBe("*");
      });
    });
  });

  describe("convertToCurrentVersionConfig (new → old format)", () => {
    describe("permissions", () => {
      it("should convert default with empty block list to base allow", () => {
        const newYaml = `
permissions:
  default:
    block: []
  consumers: {}
toolGroups: []
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(newYaml);
        const newConfig = nextVersionAppConfigSchema.parse(parsedYaml);
        const result = convertToCurrentVersionConfig(newConfig);

        expect(result.permissions).toEqual({
          base: "allow",
          consumers: {},
        });
      });

      it("should convert default with empty allow list to base block", () => {
        const newYaml = `
permissions:
  default:
    allow: []
  consumers: {}
toolGroups: []
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(newYaml);
        const newConfig = nextVersionAppConfigSchema.parse(parsedYaml);
        const result = convertToCurrentVersionConfig(newConfig);

        expect(result.permissions).toEqual({
          base: "block",
          consumers: {},
        });
      });

      it("should convert consumers from new to old format", () => {
        const newYaml = `
permissions:
  default:
    allow: []
  consumers:
    developers:
      block:
        - admin-tools
      consumerGroupKey: dev-group
    readers:
      allow:
        - read-tools
        - basic-tools
      consumerGroupKey: ""
toolGroups:
  - name: admin-tools
    services:
      slack: ["admin-message"]
  - name: read-tools
    services:
      slack: ["read-message"]
  - name: basic-tools
    services:
      github: ["read-repo"]
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(newYaml);
        const newConfig = nextVersionAppConfigSchema.parse(parsedYaml);
        const result = convertToCurrentVersionConfig(newConfig);

        expect(result.permissions).toEqual({
          base: "block",
          consumers: {
            developers: {
              base: "allow",
              profiles: {
                block: ["admin-tools"],
              },
              consumerGroupKey: "dev-group",
            },
            readers: {
              base: "block",
              profiles: {
                allow: ["read-tools", "basic-tools"],
              },
              consumerGroupKey: "",
            },
          },
        });
        expect(result.toolGroups).toHaveLength(3);
      });

      it("should handle empty allow/block arrays in consumers", () => {
        const newYaml = `
permissions:
  default:
    block: []
  consumers:
    dev:
      block: []
      consumerGroupKey: ""
    test:
      allow: []
      consumerGroupKey: ""
toolGroups: []
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(newYaml);
        const newConfig = nextVersionAppConfigSchema.parse(parsedYaml);
        const result = convertToCurrentVersionConfig(newConfig);

        expect(result.permissions.consumers["dev"]).toEqual({
          base: "allow",
          profiles: {
            block: [],
          },
          consumerGroupKey: "",
        });
        expect(result.permissions.consumers["test"]).toEqual({
          base: "block",
          profiles: {
            allow: [],
          },
          consumerGroupKey: "",
        });
      });

      it("should preserve auth and other fields", () => {
        const newYaml = `
permissions:
  default:
    block: []
  consumers: {}
toolGroups: []
auth:
  enabled: true
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(newYaml);
        const newConfig = nextVersionAppConfigSchema.parse(parsedYaml);
        const result = convertToCurrentVersionConfig(newConfig);

        expect(result.auth).toEqual({ enabled: true });
      });

      it("should handle missing consumerGroupKey", () => {
        const newYaml = `
permissions:
  default:
    allow: []
  consumers:
    user1:
      block:
        - restricted
toolGroups: []
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(newYaml);
        const newConfig = nextVersionAppConfigSchema.parse(parsedYaml);
        const result = convertToCurrentVersionConfig(newConfig);

        expect(result.permissions.consumers["user1"]).toEqual({
          base: "allow",
          profiles: {
            block: ["restricted"],
          },
          consumerGroupKey: "",
        });
      });

      it("should handle complex configuration with wildcards", () => {
        const newYaml = `
permissions:
  default:
    allow: []
  consumers:
    admin:
      block:
        - dangerous
      consumerGroupKey: admin-group
    developer:
      allow:
        - read
        - write
      consumerGroupKey: ""
    viewer:
      block: []
      consumerGroupKey: ""
toolGroups:
  - name: dangerous
    services:
      system: "*"
  - name: read
    services:
      github: ["read-repo", "read-issues"]
      slack: ["read-message"]
  - name: write
    services:
      github: ["write-repo", "create-pr"]
auth:
  enabled: false
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(newYaml);
        const newConfig = nextVersionAppConfigSchema.parse(parsedYaml);
        const result = convertToCurrentVersionConfig(newConfig);

        expect(result.permissions).toEqual({
          base: "block",
          consumers: {
            admin: {
              base: "allow",
              profiles: {
                block: ["dangerous"],
              },
              consumerGroupKey: "admin-group",
            },
            developer: {
              base: "block",
              profiles: {
                allow: ["read", "write"],
              },
              consumerGroupKey: "",
            },
            viewer: {
              base: "allow",
              profiles: {
                block: [],
              },
              consumerGroupKey: "",
            },
          },
        });
        expect(result.toolGroups[0]!.services["system"]).toBe("*");
      });
    });

    describe("round-trip conversion", () => {
      it("should maintain data integrity when converting back and forth", () => {
        const originalOldYaml = `
permissions:
  base: allow
  consumers:
    admin:
      base: block
      consumerGroupKey: admin-key
      profiles:
        allow:
          - admin-tools
          - debug-tools
    user:
      base: allow
      consumerGroupKey: ""
      profiles:
        block:
          - dangerous-tools
toolGroups:
  - name: admin-tools
    services:
      slack: ["admin-channel"]
  - name: debug-tools
    services:
      system: ["debug"]
  - name: dangerous-tools
    services:
      system: "*"
auth:
  enabled: true
toolExtensions:
  services: {}
`;
        const parsedYaml = parse(originalOldYaml);
        const originalOldConfig = appConfigSchema.parse(parsedYaml);

        // Convert to new format
        const newFormat = convertToNextVersionConfig(originalOldConfig);
        // Convert back to old format
        const backToOld = convertToCurrentVersionConfig(newFormat);

        expect(backToOld).toEqual(originalOldConfig);
      });
    });
  });
});
