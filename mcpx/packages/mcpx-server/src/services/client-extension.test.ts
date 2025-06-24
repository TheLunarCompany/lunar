import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { ExtendedClient, OriginalClientI } from "./client-extension.js";
import { ServiceToolExtensions } from "../model.js";

describe("ExtendedClient", () => {
  // Defines the config
  const serviceToolExtensions: ServiceToolExtensions = {
    "original-tool": {
      childTools: [
        {
          name: "child-tool",
          overrideParams: { bar: 42 },
          description: { _type: "append", text: "Some extra text here!" },
        },
      ],
    },
  };

  it("lists extended tools", async () => {
    const client = mockOriginalClient();
    const extendedClient = new ExtendedClient(client, serviceToolExtensions);
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
      description: string;
    };
    expect(extendedBarProperty.type).toEqual("number");
    expect(extendedBarProperty.description).toEqual(
      "Original description for bar. Note: This parameter is ignored - it is hardcoded to be 42. Pass an empty string for this parameter.",
    );
  });

  it("calls original parent tool with overridden param", async () => {
    const client = mockOriginalClient();
    const extendedClient = new ExtendedClient(client, serviceToolExtensions);

    await extendedClient.callTool({
      name: "child-tool",
      arguments: { foo: "unchanged", bar: 100 }, // bar should be ignored
    });

    expect(client.recordedCalls()).toEqual([
      { name: "original-tool", arguments: { foo: "unchanged", bar: 42 } },
    ]);
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
            },
          },
          description: "A test tool",
        },
      ],
    }),
    callTool: async ({
      name,
      arguments: args,
    }): Promise<{ result: string }> => {
      _recordedCalls.push({ name, arguments: args });
      return { result: "success" };
    },
    recordedCalls: () => _recordedCalls,
  };
}
