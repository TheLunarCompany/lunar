import { CallToolRequest, Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  ExtendedClient,
  extractToolParameters,
  OriginalClientI,
} from "./client-extension.js";
import { CatalogManagerI } from "./catalog-manager.js";

import {
  ExtensionDescription,
  ServiceToolExtensions,
} from "../model/config/tool-extensions.js";

describe("extractToolParameters", () => {
  it("should return empty array when inputSchema has no properties", () => {
    const tool: Tool = {
      name: "no-props-tool",
      inputSchema: { type: "object" },
    };

    const result = extractToolParameters(tool);

    expect(result).toEqual([]);
  });

  it("should return empty array when properties is empty object", () => {
    const tool: Tool = {
      name: "empty-props-tool",
      inputSchema: { type: "object", properties: {} },
    };

    const result = extractToolParameters(tool);

    expect(result).toEqual([]);
  });

  it("should extract parameters with descriptions", () => {
    const tool: Tool = {
      name: "tool-with-descriptions",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "The issue title" },
          body: { type: "string", description: "The issue body" },
        },
      },
    };

    const result = extractToolParameters(tool);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      name: "title",
      description: "The issue title",
    });
    expect(result).toContainEqual({
      name: "body",
      description: "The issue body",
    });
  });

  it("should handle properties without descriptions", () => {
    const tool: Tool = {
      name: "tool-no-descriptions",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          enabled: { type: "boolean" },
        },
      },
    };

    const result = extractToolParameters(tool);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ name: "id", description: undefined });
    expect(result).toContainEqual({ name: "enabled", description: undefined });
  });

  it("should handle mixed properties - some with descriptions, some without", () => {
    const tool: Tool = {
      name: "mixed-tool",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Repository owner" },
          page: { type: "number" },
          limit: { type: "number", description: "Max results" },
        },
      },
    };

    const result = extractToolParameters(tool);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual({
      name: "owner",
      description: "Repository owner",
    });
    expect(result).toContainEqual({ name: "page", description: undefined });
    expect(result).toContainEqual({
      name: "limit",
      description: "Max results",
    });
  });
});

function mockCatalogManager(
  isApproved: (serviceName: string, toolName: string) => boolean = () => true,
): CatalogManagerI {
  return {
    setCatalog: () => {},
    getCatalog: () => [],
    isStrict: () => true,
    setAdminStrictnessOverride: () => {},
    getAdminStrictnessOverride: () => false,
    getById: () => undefined,
    isServerApproved: () => true,
    isToolApproved: isApproved,
    subscribe: () => () => {},
  };
}

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
      "test-service",
      client,
      () => serviceToolExtensions,
      mockCatalogManager(),
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
      "test-service",
      client,
      () => serviceToolExtensions,
      mockCatalogManager(),
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
      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => currentConfig,
        mockCatalogManager(),
      );

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
      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => currentConfig,
        mockCatalogManager(),
      );

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

  describe("catalog approval filtering", () => {
    it("listTools filters out unapproved tools", async () => {
      const client = mockOriginalClientWithMultipleTools();
      const catalogManager = mockCatalogManager(
        (_service, tool) => tool === "approved-tool",
      );
      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => ({}),
        catalogManager,
      );

      const { tools } = await extendedClient.listTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]?.name).toBe("approved-tool");
    });

    it("callTool rejects unapproved tools without calling original client", async () => {
      const client = mockOriginalClientWithMultipleTools();
      const catalogManager = mockCatalogManager(
        (_service, tool) => tool === "approved-tool",
      );
      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => ({}),
        catalogManager,
      );

      await expect(
        extendedClient.callTool({
          name: "blocked-tool",
          arguments: {},
        }),
      ).rejects.toThrow("Tool blocked-tool is not approved");

      // Verify no call was made to the original client
      expect(client.recordedCalls()).toHaveLength(0);
    });

    it("callTool calls original client for approved tools", async () => {
      const client = mockOriginalClientWithMultipleTools();
      const catalogManager = mockCatalogManager(
        (_service, tool) => tool === "approved-tool",
      );
      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => ({}),
        catalogManager,
      );

      await extendedClient.callTool({
        name: "approved-tool",
        arguments: { foo: "bar" },
      });

      expect(client.recordedCalls()).toEqual([
        { name: "approved-tool", arguments: { foo: "bar" } },
      ]);
    });
  });

  describe("prompts passthrough", () => {
    it("listPrompts returns prompts from original client", async () => {
      const client = mockOriginalClientWithPrompts();
      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => ({}),
        mockCatalogManager(),
      );

      const response = await extendedClient.listPrompts();
      expect(response.prompts).toEqual([
        { name: "prompt-one", description: "Prompt one" },
      ]);
    });

    it("getPrompt forwards request to original client", async () => {
      const client = mockOriginalClientWithPrompts();
      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => ({}),
        mockCatalogManager(),
      );

      await extendedClient.getPrompt({
        name: "prompt-one",
        arguments: { foo: "bar" },
      });

      expect(client.recordedPromptCalls()).toEqual([
        { name: "prompt-one", arguments: { foo: "bar" } },
      ]);
    });
  });
});
type CallToolRequestParams = CallToolRequest["params"];
type GetPromptRequestParams = Parameters<OriginalClientI["getPrompt"]>[0];

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
    listPrompts: async () => ({
      prompts: [],
    }),
    getPrompt: async () => ({
      messages: [],
    }),
    getServerCapabilities: () => undefined,
    callTool: async ({ name, arguments: args }) => {
      _recordedCalls.push({ name, arguments: args });
      return { content: [{ type: "text" as const, text: "success" }] };
    },
    recordedCalls: () => _recordedCalls,
  };
}

function mockOriginalClientWithMultipleTools(): OriginalClientI & {
  recordedCalls: () => CallToolRequestParams[];
} {
  const _recordedCalls: CallToolRequestParams[] = [];
  return {
    connect: async (): Promise<void> => {},
    close: async (): Promise<void> => {},
    listTools: async () => ({
      tools: [
        {
          name: "approved-tool",
          inputSchema: { type: "object", properties: {} },
          description: "An approved tool",
        },
        {
          name: "blocked-tool",
          inputSchema: { type: "object", properties: {} },
          description: "A blocked tool",
        },
      ],
    }),
    listPrompts: async () => ({
      prompts: [],
    }),
    getPrompt: async () => ({
      messages: [],
    }),
    getServerCapabilities: () => undefined,
    callTool: async ({ name, arguments: args }) => {
      _recordedCalls.push({ name, arguments: args });
      return { content: [{ type: "text" as const, text: "success" }] };
    },
    recordedCalls: () => _recordedCalls,
  };
}

function mockOriginalClientWithPrompts(): OriginalClientI & {
  recordedPromptCalls: () => GetPromptRequestParams[];
} {
  const _recordedPromptCalls: GetPromptRequestParams[] = [];
  return {
    connect: async (): Promise<void> => {},
    close: async (): Promise<void> => {},
    listTools: async () => ({ tools: [] }),
    listPrompts: async () => ({
      prompts: [{ name: "prompt-one", description: "Prompt one" }],
    }),
    getPrompt: async (params, _options) => {
      _recordedPromptCalls.push(params);
      return {
        messages: [
          {
            role: "user",
            content: { type: "text" as const, text: "hello" },
          },
        ],
      };
    },
    getServerCapabilities: () => undefined,
    callTool: async () => ({
      content: [{ type: "text" as const, text: "success" }],
    }),
    recordedPromptCalls: () => _recordedPromptCalls,
  };
}
