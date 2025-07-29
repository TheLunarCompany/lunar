import { parse } from "yaml";
import { resetEnv } from "../src/env.js";
import { getTestHarness, TestHarness, transportTypes } from "./utils.js";
import { Config } from "../src/model/config/config.js";
import { nextVersionAppConfigSchema } from "@mcpx/shared-model";

const MCPX_BASE_URL = "http://localhost:9000";

describe("App Config", () => {
  describe.each(transportTypes)(
    "API backward compatibility over %s Router",
    (transportType) => {
      const originalEnv = { ...process.env };
      beforeEach(() => {
        process.env = { ...originalEnv };
        resetEnv();
      });
      afterAll(() => {
        process.env = { ...originalEnv };
        resetEnv();
      });

      describe("Default Configuration (old format)", () => {
        const harness = getTestHarness();

        beforeAll(async () => {
          await harness.initialize(transportType);
        });

        afterAll(async () => {
          await harness.shutdown();
        });

        it("can write config in old format and read it as old format", async () => {
          // Old format config
          const oldFormatConfig = {
            permissions: {
              base: "allow",
              consumers: {
                developers: {
                  base: "block",
                  consumerGroupKey: "dev-group",
                  profiles: {
                    allow: ["read-tools"],
                  },
                },
              },
            },
            toolGroups: [
              {
                name: "read-tools",
                services: {
                  "echo-service": ["echo"],
                },
              },
            ],
          };

          // PATCH with old format
          const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(oldFormatConfig),
          });
          expect(patchResponse.status).toBe(200);

          // GET should return old format
          const getResponse = await fetch(`${MCPX_BASE_URL}/app-config`);
          expect(getResponse.status).toBe(200);

          const responseData = await getResponse.json();
          const parsedConfig = parse(responseData.yaml);

          expect(parsedConfig.permissions).toEqual({
            base: "allow",
            consumers: {
              developers: {
                base: "block",
                consumerGroupKey: "dev-group",
                profiles: {
                  allow: ["read-tools"],
                },
              },
            },
          });
        });

        it("can write config in new format and read it as old format", async () => {
          // New format config
          const newFormatConfig = {
            permissions: {
              default: {
                allow: ["basic-tools"],
              },
              consumers: {
                admins: {
                  block: [],
                  consumerGroupKey: "admin-group",
                },
              },
            },
            toolGroups: [
              {
                name: "basic-tools",
                services: {
                  "echo-service": ["echo"],
                },
              },
            ],
          };

          // PATCH with new format
          const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newFormatConfig),
          });
          expect(patchResponse.status).toBe(200);

          // GET should return old format
          const getResponse = await fetch(`${MCPX_BASE_URL}/app-config`);
          expect(getResponse.status).toBe(200);

          const responseData = await getResponse.json();
          const parsedConfig = parse(responseData.yaml);

          expect(parsedConfig.permissions).toEqual({
            base: "block",
            consumers: {
              admins: {
                base: "allow",
                consumerGroupKey: "admin-group",
                profiles: {
                  block: [],
                },
              },
            },
          });
        });
      });

      describe("Next Version Configuration (new format)", () => {
        const harness = getTestHarness();

        beforeEach(() => {
          process.env["CONTROL_PLANE_APP_CONFIG_USE_NEXT_VERSION"] = "true";
          resetEnv();
        });

        beforeAll(async () => {
          await harness.initialize(transportType);
        });

        afterAll(async () => {
          await harness.shutdown();
        });

        it("can write config in old format and read it as new format", async () => {
          // Old format config
          const oldFormatConfig = {
            permissions: {
              base: "block",
              consumers: {
                "power-users": {
                  base: "allow",
                  consumerGroupKey: "power-group",
                  profiles: {
                    block: ["admin-tools"],
                  },
                },
              },
            },
            toolGroups: [
              {
                name: "admin-tools",
                services: {
                  "calculator-service": ["powerOfTwo"],
                },
              },
            ],
          };

          // PATCH with old format
          const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(oldFormatConfig),
          });
          expect(patchResponse.status).toBe(200);

          // GET should return new format
          const getResponse = await fetch(`${MCPX_BASE_URL}/app-config`);
          expect(getResponse.status).toBe(200);

          const responseData = await getResponse.json();
          const parsedConfig = parse(responseData.yaml);

          expect(parsedConfig.permissions).toEqual({
            default: {
              allow: [],
            },
            consumers: {
              "power-users": {
                block: ["admin-tools"],
                consumerGroupKey: "power-group",
              },
            },
          });
        });

        it("can write config in new format and read it as new format", async () => {
          // New format config
          const newFormatConfig = {
            permissions: {
              default: {
                block: ["dangerous-tools"],
              },
              consumers: {
                guests: {
                  allow: ["safe-tools"],
                  consumerGroupKey: "guest-group",
                },
              },
            },
            toolGroups: [
              {
                name: "safe-tools",
                services: {
                  "echo-service": ["echo"],
                },
              },
              {
                name: "dangerous-tools",
                services: {
                  "calculator-service": ["powerOfTwo"],
                },
              },
            ],
          };

          // PATCH with new format
          const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newFormatConfig),
          });
          expect(patchResponse.status).toBe(200);

          // GET should return new format
          const getResponse = await fetch(`${MCPX_BASE_URL}/app-config`);
          expect(getResponse.status).toBe(200);

          const responseData = await getResponse.json();
          const parsedConfig = parse(responseData.yaml);

          expect(parsedConfig.permissions).toEqual({
            default: {
              block: ["dangerous-tools"],
            },
            consumers: {
              guests: {
                allow: ["safe-tools"],
                consumerGroupKey: "guest-group",
              },
            },
          });
        });

        it("handles full config with all fields correctly", async () => {
          // Full config with all supported fields
          const fullConfig = {
            permissions: {
              default: {
                block: [],
              },
              consumers: {
                testers: {
                  allow: ["test-tools"],
                  consumerGroupKey: "test-group",
                },
              },
            },
            toolGroups: [
              {
                name: "test-tools",
                services: {
                  "echo-service": ["echo"],
                  "calculator-service": ["add"],
                },
              },
            ],
            auth: {
              enabled: false,
            },
            toolExtensions: {
              services: {
                "echo-service": {
                  echo: {
                    childTools: [
                      {
                        name: "echo_custom",
                        description: {
                          action: "rewrite",
                          text: "Custom echo tool for testing",
                        },
                        overrideParams: {},
                      },
                    ],
                  },
                },
              },
            },
          };

          // PATCH with full config
          const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fullConfig),
          });
          expect(patchResponse.status).toBe(200);

          // GET and verify all fields are preserved
          const getResponse = await fetch(`${MCPX_BASE_URL}/app-config`);
          expect(getResponse.status).toBe(200);

          const responseData = await getResponse.json();
          const parsedConfig = parse(responseData.yaml);

          // Verify permissions (without _type type fields since KEEP_DISCRIMINATING_TAGS is not set)
          expect(parsedConfig.permissions).toEqual({
            default: {
              block: [],
            },
            consumers: {
              testers: {
                allow: ["test-tools"],
                consumerGroupKey: "test-group",
              },
            },
          });

          // Verify toolGroups
          expect(parsedConfig.toolGroups).toEqual(fullConfig.toolGroups);

          // Verify auth
          expect(parsedConfig.auth).toEqual(fullConfig.auth);

          // Verify toolExtensions
          expect(parsedConfig.toolExtensions).toEqual(
            fullConfig.toolExtensions,
          );
        });
      });

      describe("Next Version + Keep Discriminating Tags Configuration", () => {
        const harness = getTestHarness();

        beforeAll(async () => {
          await harness.initialize(transportType);
        });

        afterAll(async () => {
          await harness.shutdown();
        });

        beforeEach(() => {
          process.env["CONTROL_PLANE_APP_CONFIG_USE_NEXT_VERSION"] = "true";
          process.env["CONTROL_PLANE_APP_CONFIG_KEEP_DISCRIMINATING_TAGS"] =
            "true";
          resetEnv();
        });

        it("preserves _type discriminating tags", async () => {
          // New format config with _type fields
          const newFormatConfig = {
            permissions: {
              default: {
                block: ["restricted"],
              },
              consumers: {
                "api-users": {
                  allow: ["public-tools"],
                  consumerGroupKey: "api-group",
                },
              },
            },
            toolGroups: [
              {
                name: "public-tools",
                services: {
                  "echo-service": ["echo"],
                },
              },
              {
                name: "restricted",
                services: {
                  "calculator-service": ["powerOfTwo"],
                },
              },
            ],
          };

          // PATCH with new format
          const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newFormatConfig),
          });
          expect(patchResponse.status).toBe(200);

          // GET should preserve _type fields
          const getResponse = await fetch(`${MCPX_BASE_URL}/app-config`);
          expect(getResponse.status).toBe(200);

          const responseData = await getResponse.json();
          const parsedConfig = parse(responseData.yaml);

          // Verify _type fields are preserved
          expect(parsedConfig.permissions.default).toHaveProperty(
            "_type",
            "default-allow",
          );
          expect(
            parsedConfig.permissions.consumers["api-users"],
          ).toHaveProperty("_type", "default-block");

          // Verify full structure
          expect(parsedConfig.permissions).toEqual({
            default: {
              _type: "default-allow",
              block: ["restricted"],
            },
            consumers: {
              "api-users": {
                _type: "default-block",
                allow: ["public-tools"],
                consumerGroupKey: "api-group",
              },
            },
          });
        });
      });
    },
  );
  describe.each(transportTypes)(
    "Validations over %s Router",
    (transportType) => {
      const originalEnv = { ...process.env };
      beforeEach(() => {
        process.env = { ...originalEnv };
        resetEnv();
      });
      afterAll(() => {
        process.env = { ...originalEnv };
        resetEnv();
      });

      describe("config updates", () => {
        let testHarness: TestHarness;

        beforeAll(async () => {
          testHarness = getTestHarness();
          await testHarness.initialize(transportType);
        });

        afterAll(async () => {
          await testHarness.shutdown();
        });

        it("rejects config with invalid schema", async () => {
          const invalidConfig = {
            permissions: {
              default: {
                block: "*", // This is a mistake! must be an array
              },
              consumers: {},
            },
            toolGroups: [
              {
                name: "foo",
                services: ["echoService"], // This is a mistake! must be an object with service names as keys
              },
            ],
          };

          const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(invalidConfig),
          });
          expect(patchResponse.status).toBe(400);
        });
        it("rejects config with valid schema but not-workable values", async () => {
          const invalidConfig: Config = nextVersionAppConfigSchema.parse({
            permissions: {
              default: {
                block: ["foo-with-typo"],
              },
              consumers: {},
            },
            toolGroups: [
              {
                name: "foo",
                services: {
                  "echo-service": ["echo"],
                },
              },
            ],
            auth: { enabled: false },
            toolExtensions: { services: {} },
          });

          const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(invalidConfig),
          });
          expect(patchResponse.status).toBe(400);

          const errorData = await patchResponse.json();
          expect(errorData.error).toContain("Config update rejected");
        });
      });
    },
  );
});
