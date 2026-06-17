import {
  CallToolRequest,
  ErrorCode,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  ExtendedClient,
  extractToolParameters,
  OriginalClientI,
} from "./client-extension.js";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { ZodError } from "zod/v4";

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
      noOpLogger,
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
      noOpLogger,
    );

    await extendedClient.callTool({
      name: "child-tool",
      arguments: { foo: "unchanged", bar: 100, baz: "baz", qux: 1 },
      _meta: { progressToken: "token-1" },
    });

    expect(client.recordedCalls()).toEqual([
      {
        name: "original-tool",
        arguments: { foo: "unchanged", bar: 42, baz: "baz", qux: null },
        _meta: { progressToken: "token-1" },
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
        noOpLogger,
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
        noOpLogger,
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

  describe("annotation inheritance", () => {
    it("child tool inherits annotations from parent", async () => {
      const client: OriginalClientI = {
        connect: async () => {},
        close: async () => {},
        listTools: async () => ({
          tools: [
            {
              name: "original-tool",
              inputSchema: { type: "object" },
              description: "A tool with annotations",
              annotations: { readOnlyHint: true, idempotentHint: true },
            },
          ],
        }),
        setNotificationHandler: () => {},
        ping: async () => ({}),
        callTool: async () => ({
          content: [{ type: "text" as const, text: "success" }],
        }),
      };

      const extensions: ServiceToolExtensions = {
        "original-tool": {
          childTools: [{ name: "child-tool", overrideParams: {} }],
        },
      };

      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => extensions,
        noOpLogger,
      );

      const { tools } = await extendedClient.listTools();
      const childTool = tools.find((t) => t.name === "child-tool");

      expect(childTool?.annotations).toEqual({
        readOnlyHint: true,
        idempotentHint: true,
      });
    });

    it("child tool has no annotations when parent has none", async () => {
      const client: OriginalClientI = {
        connect: async () => {},
        close: async () => {},
        listTools: async () => ({
          tools: [
            {
              name: "original-tool",
              inputSchema: { type: "object" },
            },
          ],
        }),
        setNotificationHandler: () => {},
        ping: async () => ({}),
        callTool: async () => ({
          content: [{ type: "text" as const, text: "success" }],
        }),
      };

      const extensions: ServiceToolExtensions = {
        "original-tool": {
          childTools: [{ name: "child-tool", overrideParams: {} }],
        },
      };

      const extendedClient = new ExtendedClient(
        "test-service",
        client,
        () => extensions,
        noOpLogger,
      );

      const { tools } = await extendedClient.listTools();
      const childTool = tools.find((t) => t.name === "child-tool");

      expect(childTool?.annotations).toBeUndefined();
    });
  });
});
describe("ExtendedClient.isAlive", () => {
  it("returns null when ping succeeds", async () => {
    const client = mockOriginalClientWithPing(async () => ({}));
    const extendedClient = new ExtendedClient(
      "test",
      client,
      () => ({}),
      noOpLogger,
    );
    expect(await extendedClient.isAlive(1000)).toBeNull();
  });

  it("returns null when server returns MethodNotFound (-32601) as McpError — ping not supported, server is alive", async () => {
    const client = mockOriginalClientWithPing(async () => {
      throw new McpError(ErrorCode.MethodNotFound, "Method not found");
    });
    const extendedClient = new ExtendedClient(
      "test",
      client,
      () => ({}),
      noOpLogger,
    );
    expect(await extendedClient.isAlive(1000)).toBeNull();
  });

  it("returns null when streamable-http transport wraps MethodNotFound in a plain Error", async () => {
    const client = mockOriginalClientWithPing(async () => {
      throw new Error(
        `Streamable HTTP error: Error POSTing to endpoint: {"jsonrpc":"2.0","error":{"code":-32601,"message":"Method not found","data":{"method":"ping"}},"id":8}`,
      );
    });
    const extendedClient = new ExtendedClient(
      "test",
      client,
      () => ({}),
      noOpLogger,
    );
    expect(await extendedClient.isAlive(1000)).toBeNull();
  });

  it("does not call ping after MethodNotFound is detected — subsequent calls are a no-op returning null", async () => {
    let pingCallCount = 0;
    const client = mockOriginalClientWithPing(async () => {
      pingCallCount++;
      throw new McpError(ErrorCode.MethodNotFound, "Method not found");
    });
    const extendedClient = new ExtendedClient(
      "test",
      client,
      () => ({}),
      noOpLogger,
    );

    expect(await extendedClient.isAlive(1000)).toBeNull();
    expect(pingCallCount).toBe(1);

    expect(await extendedClient.isAlive(1000)).toBeNull();
    expect(pingCallCount).toBe(1); // no second network call
  });

  it("returns null when server returns a ZodError — server is reachable but response does not match the schema", async () => {
    const client = mockOriginalClientWithPing(async () => {
      throw new ZodError([]);
    });
    const extendedClient = new ExtendedClient(
      "test",
      client,
      () => ({}),
      noOpLogger,
    );
    expect(await extendedClient.isAlive(1000)).toBeNull();
  });

  it("does not call ping after invalid response format is detected — subsequent calls are a no-op returning null", async () => {
    let pingCallCount = 0;
    const client = mockOriginalClientWithPing(async () => {
      pingCallCount++;
      throw new ZodError([]);
    });
    const extendedClient = new ExtendedClient(
      "test",
      client,
      () => ({}),
      noOpLogger,
    );

    expect(await extendedClient.isAlive(1000)).toBeNull();
    expect(pingCallCount).toBe(1);

    expect(await extendedClient.isAlive(1000)).toBeNull();
    expect(pingCallCount).toBe(1); // no second network call
  });

  it("returns an Error when ping fails with a non-ZodError/non-MethodNotFound — only ZodError and MethodNotFound is treated as alive", async () => {
    const client = mockOriginalClientWithPing(async () => {
      throw new Error("connection refused");
    });
    const extendedClient = new ExtendedClient(
      "test",
      client,
      () => ({}),
      noOpLogger,
    );
    const result = await extendedClient.isAlive(1000);
    expect(result).toBeInstanceOf(Error);
    expect(result instanceof Error && result.message).toBe(
      "connection refused",
    );
  });
});

function mockOriginalClientWithPing(
  ping: () => Promise<object>,
): OriginalClientI {
  return {
    connect: async () => {},
    close: async () => {},
    listTools: async () => ({ tools: [] }),
    setNotificationHandler: () => {},
    ping,
    callTool: async () => ({
      content: [{ type: "text" as const, text: "success" }],
    }),
  };
}

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
    setNotificationHandler: () => {},
    ping: async () => ({}),
    callTool: async (params) => {
      _recordedCalls.push(params);
      return { content: [{ type: "text" as const, text: "success" }] };
    },
    recordedCalls: () => _recordedCalls,
  };
}
