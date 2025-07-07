import { ToolExtensions } from "../src/model.js";
import { buildConfig, getTestHarness, transportTypes } from "./utils.js";

describe.each(transportTypes)(
  "Tools Customization over %s Router",
  (transportType) => {
    const toolExtensions: ToolExtensions = {
      services: {
        "calculator-service": {
          add: {
            childTools: [
              {
                name: "add_10",
                description: {
                  action: "rewrite",
                  text: "Adds 10 to the a number",
                },
                overrideParams: { b: 10 },
              },
            ],
          },
          powerOfTwo: {
            childTools: [
              {
                name: "powerOfTwo_for_2",
                description: {
                  action: "append",
                  text: "This tool will always return 4 since it's only parameter is hardcoded to 2",
                },
                overrideParams: { base: 2 },
              },
            ],
          },
        },
      },
    };
    const config = buildConfig({ toolExtensions });
    const testHarness = getTestHarness({ config });
    beforeAll(async () => {
      await testHarness.initialize(transportType);
    });

    afterAll(async () => {
      await testHarness.shutdown();
    });

    it("overrides param when calling tool", async () => {
      const res = await testHarness.client.callTool({
        name: "calculator-service__add_10",
        arguments: { a: 5, b: 2 },
      });
      const result = (res.content as [{ text: string }])[0];

      expect(result.text).toEqual("Result: 15");
    });

    it("overrides only param when calling tool", async () => {
      const res = await testHarness.client.callTool({
        name: "calculator-service__powerOfTwo_for_2",
        arguments: { base: 3 },
      });
      const result = (res.content as [{ text: string }])[0];

      expect(result.text).toEqual("Result: 4");
    });

    it("rewrites tool's description", async () => {
      const tools = await testHarness.client.listTools();
      const add10Tool = tools.tools.find(
        (t) => t.name === "calculator-service__add_10",
      );
      expect(add10Tool).toBeDefined();
      expect(add10Tool?.description).toEqual("Adds 10 to the a number");
    });

    it("appends to tool's description", async () => {
      const tools = await testHarness.client.listTools();
      const powerOfTwoTool = tools.tools.find(
        (t) => t.name === "calculator-service__powerOfTwo_for_2",
      );
      expect(powerOfTwoTool).toBeDefined();
      expect(powerOfTwoTool?.description).toEqual(
        "Calculates the power of two for a given number. This tool will always return 4 since it's only parameter is hardcoded to 2",
      );
    });

    it("annotates overridden argument in inputSchema", async () => {
      const tools = await testHarness.client.listTools();
      const add10Tool = tools.tools.find(
        (t) => t.name === "calculator-service__add_10",
      );
      expect(add10Tool?.inputSchema).toBeDefined();
      const properties = add10Tool?.inputSchema?.properties as {
        a: { type: string; description?: string };
        b: { type: string; description?: string };
      };
      expect(properties.a.type).toEqual("number");
      expect(properties.b.type).toEqual("number");

      expect(properties.a.description).toBeUndefined();
      expect(properties.b.description).toBeDefined();
      expect(properties.b.description).toMatch(
        /Note: This parameter is ignored - it is hardcoded to be 10. Pass an empty string for this parameter.$/,
      );
    });
  },
);
