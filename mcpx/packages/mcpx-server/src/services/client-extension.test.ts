import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { ExtendedClient, OriginalClientI } from "./client-extension.js";

import {
  ExtensionDescription,
  ServiceToolExtensions,
} from "../model/config/tool-extensions.js";

describe("ExtendedClient", () => {
  // Defines the config
  const serviceToolExtensions: ServiceToolExtensions = {
    "original-tool": {
      childTools: [
        {
          name: "child-tool",
          overrideParams: {
            bar: { value: 42 },
            baz: {
              description: {
                action: "rewrite",
                text: "Completely new description for baz",
              },
            },
            qux: { value: null },
          },
          description: { action: "append", text: "Some extra text here!" },
        },
      ],
    },
  };

  it("lists extended tools", async () => {
    const client = mockOriginalClient();
    const extendedClient = new ExtendedClient(
      client,
      () => serviceToolExtensions,
    );
    const { tools } = await extendedClient.listTools();
    expect(tools).toHaveLength(2);
    const originalTool = tools.find((tool) => tool.name === "original-tool");
    expect(originalTool).toBeDefined();
    // original tool should not be modified
    expect(originalTool?.name).toBe("original-tool");
    expect(originalTool?.description).toBe("A test tool");
    const originalClientTools = await client.listTools();
    expect(originalTool?.inputSchema).toEqual(
      originalClientTools.tools[0]?.inputSchema,
    );

    // child tool should be added
    const childTool = tools.find((tool) => tool.name === "child-tool");
    expect(childTool).toBeDefined();
    expect(childTool?.name).toBe("child-tool");
    expect(childTool?.description).toBe("A test tool. Some extra text here!");
    expect(childTool?.inputSchema.type).toEqual("object");
    expect(childTool?.inputSchema.properties!["foo"]).toEqual(
      originalClientTools.tools[0]?.inputSchema.properties!["foo"],
    );
    const extendedBarProperty = childTool?.inputSchema.properties!["bar"] as {
      type: string;
      description: ExtensionDescription;
    };
    expect(extendedBarProperty.type).toEqual("number");
    expect(extendedBarProperty.description).toEqual(
      "Original description for bar. Note: This parameter is ignored - it is hardcoded to be 42. Pass an empty string for this parameter.",
    );

    // Check the override object for 'baz'
    const extendedBazProperty = childTool?.inputSchema.properties!["baz"] as
      | {
          type: string;
          description: ExtensionDescription;
        }
      | undefined;
    expect(extendedBazProperty).toBeDefined();
    expect(extendedBazProperty!.description).toEqual(
      "Completely new description for baz",
    );
  });

  it("calls original parent tool with overridden param", async () => {
    const client = mockOriginalClient();
    const extendedClient = new ExtendedClient(
      client,
      () => serviceToolExtensions,
    );

    await extendedClient.callTool({
      name: "child-tool",
      arguments: { foo: "unchanged", bar: 100, baz: "baz", qux: 1 },
    });

    expect(client.recordedCalls()).toEqual([
      {
        name: "original-tool",
        arguments: { foo: "unchanged", bar: 42, baz: "baz", qux: null },
      },
    ]);
  });

  describe("invalidateCache", () => {
    // Cache should be invalidated when config changes.
    // The actual wiring is done in ExtendedClientBuilder.
    // Caching is important in order to avoid recomputing the extended tools on every toolCall.
    // Here we just test that invalidateCache works as expected.
    it("listTools always computes fresh results from config", async () => {
      let currentConfig: ServiceToolExtensions = {
        "original-tool": {
          childTools: [
            {
              name: "child-v1",
              overrideParams: { bar: { value: 10 } },
            },
          ],
        },
      };
      const client = mockOriginalClient();
      const extendedClient = new ExtendedClient(client, () => currentConfig);

      // Initial listTools should show child-v1
      const { tools: toolsV1 } = await extendedClient.listTools();
      expect(toolsV1.find((t) => t.name === "child-v1")).toBeDefined();
      expect(toolsV1.find((t) => t.name === "child-v2")).toBeUndefined();

      // Change config
      currentConfig = {
        "original-tool": {
          childTools: [
            {
              name: "child-v2",
              overrideParams: { bar: { value: 20 } },
            },
          ],
        },
      };

      // listTools always rebuilds from current config - no invalidation needed
      const { tools: toolsV2 } = await extendedClient.listTools();
      expect(toolsV2.find((t) => t.name === "child-v1")).toBeUndefined();
      expect(toolsV2.find((t) => t.name === "child-v2")).toBeDefined();
    });

    it("callTool uses fresh config after invalidateCache", async () => {
      let currentConfig: ServiceToolExtensions = {
        "original-tool": {
          childTools: [
            {
              name: "child-tool",
              overrideParams: { bar: { value: 100 } },
            },
          ],
        },
      };
      const client = mockOriginalClient();
      const extendedClient = new ExtendedClient(client, () => currentConfig);

      // Prime cache
      await extendedClient.listTools();

      // Call with initial config - bar should be overridden to 100
      await extendedClient.callTool({
        name: "child-tool",
        arguments: { foo: "test", bar: 999 },
      });
      expect(client.recordedCalls()[0]).toEqual({
        name: "original-tool",
        arguments: { foo: "test", bar: 100 },
      });

      // Change config - new override value
      currentConfig = {
        "original-tool": {
          childTools: [
            {
              name: "child-tool",
              overrideParams: { bar: { value: 200 } },
            },
          ],
        },
      };

      // Without invalidateCache, uses old override value
      await extendedClient.callTool({
        name: "child-tool",
        arguments: { foo: "test", bar: 999 },
      });
      expect(client.recordedCalls()[1]).toEqual({
        name: "original-tool",
        arguments: { foo: "test", bar: 100 }, // still 100, not 200
      });

      // After invalidateCache, uses new override value
      extendedClient.invalidateCache();
      await extendedClient.listTools(); // re-prime cache
      await extendedClient.callTool({
        name: "child-tool",
        arguments: { foo: "test", bar: 999 },
      });
      expect(client.recordedCalls()[2]).toEqual({
        name: "original-tool",
        arguments: { foo: "test", bar: 200 }, // now 200
      });
    });
  });
});
type CallToolRequestParams = CallToolRequest["params"];

// A utility mock for the OriginalClientI interface
// that records calls to the `callTool` method.
// Recording allows us to assert which calls were actually made to the original client.
function mockOriginalClient(): OriginalClientI & {
  recordedCalls: () => CallToolRequestParams[];
} {
  const _recordedCalls: CallToolRequestParams[] = [];
  return {
    connect: async (): Promise<void> => {},
    close: async (): Promise<void> => {},
    listTools: async () => ({
      tools: [
        {
          name: "original-tool",
          inputSchema: {
            type: "object",
            properties: {
              foo: {
                type: "string",
                description: "Original description for foo",
              },
              bar: {
                type: "number",
                description: "Original description for bar",
              },
              baz: {
                type: "string",
                description: "Original description for baz",
              },
              qux: {
                type: "number",
                description: "Original description for qux",
              },
            },
          },
          description: "A test tool",
        },
      ],
    }),
    callTool: async ({ name, arguments: args }) => {
      _recordedCalls.push({ name, arguments: args });
      return { content: [{ type: "text" as const, text: "success" }] };
    },
    recordedCalls: () => _recordedCalls,
  };
}
