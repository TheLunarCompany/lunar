import { parse } from "yaml";
import { getTestHarness, TestHarness, transportTypes } from "./utils.js";
import { Config } from "../src/model/config/config.js";
import { appConfigSchema } from "@mcpx/shared-model";

const MCPX_BASE_URL = "http://localhost:9000";

describe("App Config", () => {
  describe.each(transportTypes)("API over %s Router", (transportType) => {
    describe("config operations", () => {
      const harness = getTestHarness();

      beforeAll(async () => {
        await harness.initialize(transportType);
      });

      afterAll(async () => {
        await harness.shutdown();
      });

      it("can write config and read it back", async () => {
        const config = {
          permissions: {
            default: {
              _type: "default-allow",
              block: ["dangerous-tools"],
            },
            consumers: {
              guests: {
                _type: "default-block",
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

        // PATCH config
        const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        expect(patchResponse.status).toBe(200);

        // GET should return the config
        const getResponse = await fetch(`${MCPX_BASE_URL}/app-config`);
        expect(getResponse.status).toBe(200);

        const responseData = await getResponse.json();
        const parsedConfig = parse(responseData.yaml);

        expect(parsedConfig.permissions).toEqual({
          default: {
            _type: "default-allow",
            block: ["dangerous-tools"],
          },
          consumers: {
            guests: {
              _type: "default-block",
              allow: ["safe-tools"],
              consumerGroupKey: "guest-group",
            },
          },
        });
      });

      it("handles full config with all fields correctly", async () => {
        const fullConfig = {
          permissions: {
            default: {
              _type: "default-allow",
              block: [],
            },
            consumers: {
              testers: {
                _type: "default-block",
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

        expect(parsedConfig.permissions).toEqual({
          default: {
            _type: "default-allow",
            block: [],
          },
          consumers: {
            testers: {
              _type: "default-block",
              allow: ["test-tools"],
              consumerGroupKey: "test-group",
            },
          },
        });

        expect(parsedConfig.toolGroups).toEqual(fullConfig.toolGroups);
        expect(parsedConfig.auth).toEqual(fullConfig.auth);
        expect(parsedConfig.toolExtensions).toEqual(fullConfig.toolExtensions);
      });

      it("preserves _type discriminating tags", async () => {
        const config = {
          permissions: {
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

        // PATCH config
        const patchResponse = await fetch(`${MCPX_BASE_URL}/app-config`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
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
        expect(parsedConfig.permissions.consumers["api-users"]).toHaveProperty(
          "_type",
          "default-block",
        );
      });
    });
  });

  describe.each(transportTypes)(
    "Validations over %s Router",
    (transportType) => {
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
                _type: "default-allow",
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
          const invalidConfig: Config = appConfigSchema.parse({
            permissions: {
              default: {
                _type: "default-allow",
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
            targetServerAttributes: {},
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
