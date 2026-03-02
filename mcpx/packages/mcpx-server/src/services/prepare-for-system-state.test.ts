import { describe, it, expect } from "@jest/globals";
import {
  prepareForSystemState,
  prepareError,
} from "./prepare-for-system-state.js";
import { ExtendedClientI } from "./client-extension.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

const stubEstimateTokens = () => 42;

const stdioServer = {
  type: "stdio" as const,
  name: "my-stdio",
  command: "node" as const,
  args: ["server.js"],
  env: {},
};

const sseServer = {
  type: "sse" as const,
  name: "my-sse",
  url: "http://localhost:3000",
};

const streamableServer = {
  type: "streamable-http" as const,
  name: "my-streamable",
  url: "http://localhost:4000",
};

describe("prepareForSystemState", () => {
  describe("connecting", () => {
    it("produces connecting state with empty tools for stdio", async () => {
      const result = await prepareForSystemState(
        { _state: "connecting", targetServer: stdioServer },
        stubEstimateTokens,
      );

      expect(result).toEqual({
        _type: "stdio",
        state: { type: "connecting" },
        ...stdioServer,
        tools: [],
        originalTools: [],
      });
    });

    it("produces connecting state for sse", async () => {
      const result = await prepareForSystemState(
        { _state: "connecting", targetServer: sseServer },
        stubEstimateTokens,
      );

      expect(result._type).toBe("sse");
      expect(result.state).toEqual({ type: "connecting" });
      expect(result.tools).toEqual([]);
    });

    it("produces connecting state for streamable-http", async () => {
      const result = await prepareForSystemState(
        { _state: "connecting", targetServer: streamableServer },
        stubEstimateTokens,
      );

      expect(result._type).toBe("streamable-http");
      expect(result.state).toEqual({ type: "connecting" });
      expect(result.tools).toEqual([]);
    });
  });

  describe("connected", () => {
    const makeTool = (name: string): Tool => ({
      name,
      description: `does ${name}`,
      inputSchema: {
        type: "object" as const,
        properties: { arg: { type: "string", description: "an arg" } },
      },
    });

    const makeExtendedClient = (tools: Tool[]): ExtendedClientI =>
      ({
        close: async () => {},
        listTools: async () => ({ tools }),
        originalTools: async () => ({ tools }),
        callTool: async () => ({ content: [] }),
        listPrompts: async () => ({ prompts: [] }),
        getPrompt: async () => ({ messages: [] }),
        getServerCapabilities: () => ({}),
      }) as unknown as ExtendedClientI;

    it("enriches tools with parameters and token estimates", async () => {
      const tools = [makeTool("read-file"), makeTool("write-file")];
      const result = await prepareForSystemState(
        {
          _state: "connected",
          targetServer: stdioServer,
          extendedClient: makeExtendedClient(tools),
        },
        () => 100, // tokens
      );

      expect(result.state).toEqual({ type: "connected" });
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0]?.name).toBe("read-file");
      expect(result.tools[0]?.estimatedTokens).toBe(100);
      expect(result.tools[0]?.parameters).toEqual([
        { name: "arg", description: "an arg" },
      ]);
    });

    it("passes each tool to estimateTokens", async () => {
      const toolNames: string[] = [];
      const tools = [makeTool("first"), makeTool("second")];
      const result = await prepareForSystemState(
        {
          _state: "connected",
          targetServer: sseServer,
          extendedClient: makeExtendedClient(tools),
        },
        (tool) => {
          toolNames.push(tool.name);
          return tool.name.length; // dummy token estimate based on name length
        },
      );

      expect(toolNames.length).toBe(2);
      expect(toolNames).toContain("first");
      expect(toolNames).toContain("second");
      const readFileTool = result.tools.find((t) => t.name === "first");
      const writeFileTool = result.tools.find((t) => t.name === "second");
      // literally the length of the words "first" and "second"...
      expect(readFileTool?.estimatedTokens).toBe(5);
      expect(writeFileTool?.estimatedTokens).toBe(6);
    });
  });

  describe("pending-auth", () => {
    it("produces pending-auth state with empty tools", async () => {
      const result = await prepareForSystemState(
        { _state: "pending-auth", targetServer: sseServer },
        stubEstimateTokens,
      );

      expect(result.state).toEqual({ type: "pending-auth" });
      expect(result.tools).toEqual([]);
      expect(result.originalTools).toEqual([]);
    });
  });

  describe("pending-input", () => {
    it("carries missingEnvVars through", async () => {
      const missingEnvVars = [
        { key: "API_KEY", type: "literal" as const },
        { key: "SECRET", type: "fromEnv" as const, fromEnvName: "MY_SECRET" },
      ];

      const result = await prepareForSystemState(
        {
          _state: "pending-input",
          targetServer: stdioServer,
          missingEnvVars,
        },
        stubEstimateTokens,
      );

      expect(result.state).toEqual({
        type: "pending-input",
        missingEnvVars,
      });
      expect(result.tools).toEqual([]);
    });
  });

  describe("connection-failed", () => {
    it("serializes the error", async () => {
      const error = new Error("connection refused");

      const result = await prepareForSystemState(
        {
          _state: "connection-failed",
          targetServer: streamableServer,
          error,
        },
        stubEstimateTokens,
      );

      expect(result.state).toEqual({
        type: "connection-failed",
        error: {
          name: "Error",
          message: "connection refused",
          stack: error.stack,
        },
      });
      expect(result._type).toBe("streamable-http");
      expect(result.tools).toEqual([]);
    });
  });
});

describe("prepareError", () => {
  it("extracts name, message, and stack", () => {
    const error = new TypeError("bad input");

    expect(prepareError(error)).toEqual({
      name: "TypeError",
      message: "bad input",
      stack: error.stack,
    });
  });
});
