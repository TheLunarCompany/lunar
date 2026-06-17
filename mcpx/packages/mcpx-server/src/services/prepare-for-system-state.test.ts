import { describe, it, expect } from "@jest/globals";
import {
  prepareForSystemState,
  prepareError,
} from "./prepare-for-system-state.js";
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
    it("produces connecting state with empty tools for stdio", () => {
      const result = prepareForSystemState(
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

    it("produces connecting state for sse", () => {
      const result = prepareForSystemState(
        { _state: "connecting", targetServer: sseServer },
        stubEstimateTokens,
      );

      expect(result._type).toBe("sse");
      expect(result.state).toEqual({ type: "connecting" });
      expect(result.tools).toEqual([]);
    });

    it("produces connecting state for streamable-http", () => {
      const result = prepareForSystemState(
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

    it("enriches tools with parameters and token estimates", () => {
      const tools = [makeTool("read-file"), makeTool("write-file")];
      const result = prepareForSystemState(
        {
          _state: "connected",
          targetServer: stdioServer,
          extendedClient: {} as never,
        },
        () => 100,
        tools,
      );

      expect(result.state).toEqual({ type: "connected" });
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0]?.name).toBe("read-file");
      expect(result.tools[0]?.estimatedTokens).toBe(100);
      expect(result.tools[0]?.parameters).toEqual([
        { name: "arg", description: "an arg" },
      ]);
    });

    it("passes each tool to estimateTokens", () => {
      const toolNames: string[] = [];
      const tools = [makeTool("first"), makeTool("second")];
      const result = prepareForSystemState(
        {
          _state: "connected",
          targetServer: sseServer,
          extendedClient: {} as never,
        },
        (tool) => {
          toolNames.push(tool.name);
          return tool.name.length;
        },
        tools,
      );

      expect(toolNames.length).toBe(2);
      expect(toolNames).toContain("first");
      expect(toolNames).toContain("second");
      const readFileTool = result.tools.find((t) => t.name === "first");
      const writeFileTool = result.tools.find((t) => t.name === "second");
      expect(readFileTool?.estimatedTokens).toBe(5);
      expect(writeFileTool?.estimatedTokens).toBe(6);
    });

    it("passes originalTools through verbatim", () => {
      const approved = [makeTool("a")];
      const raw = [makeTool("a"), makeTool("dropped")];
      const result = prepareForSystemState(
        {
          _state: "connected",
          targetServer: stdioServer,
          extendedClient: {} as never,
        },
        stubEstimateTokens,
        approved,
        raw,
      );

      expect(result.originalTools).toEqual(raw);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]?.name).toBe("a");
    });

    it("originalTools defaults to [] when omitted (does not echo approvedTools)", () => {
      // The previous default echoed approvedTools as originalTools, which
      // silently inverted the meaning when callers forgot to pass the raw
      // upstream list. Empty is the safer default.
      const approved = [makeTool("a")];
      const result = prepareForSystemState(
        {
          _state: "connected",
          targetServer: stdioServer,
          extendedClient: {} as never,
        },
        stubEstimateTokens,
        approved,
      );

      expect(result.originalTools).toEqual([]);
    });

    it("produces empty tools when no approvedCapabilities provided", () => {
      const result = prepareForSystemState(
        {
          _state: "connected",
          targetServer: stdioServer,
          extendedClient: {} as never,
        },
        stubEstimateTokens,
      );

      expect(result.tools).toEqual([]);
      expect(result.originalTools).toEqual([]);
    });
  });

  describe("pending-auth", () => {
    it("passes through caller-provided tools (auth tool comes from the registry via the resolver)", () => {
      const authTool: Tool = {
        name: "request_authentication_link",
        description: "auth",
        inputSchema: { type: "object" as const, properties: {} },
      };
      const result = prepareForSystemState(
        { _state: "pending-auth", targetServer: sseServer },
        stubEstimateTokens,
        [authTool],
        [],
      );

      expect(result.state).toEqual({ type: "pending-auth" });
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]?.name).toBe("request_authentication_link");
      expect(result.originalTools).toEqual([]);
    });

    it("yields no tools when caller passes none", () => {
      const result = prepareForSystemState(
        { _state: "pending-auth", targetServer: sseServer },
        stubEstimateTokens,
      );

      expect(result.state).toEqual({ type: "pending-auth" });
      expect(result.tools).toEqual([]);
      expect(result.originalTools).toEqual([]);
    });
  });

  describe("pending-input", () => {
    it("carries missingEnvVars through", () => {
      const missingEnvVars = [
        { key: "API_KEY", type: "literal" as const },
        { key: "SECRET", type: "fromEnv" as const, fromEnvName: "MY_SECRET" },
      ];

      const result = prepareForSystemState(
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
    it("serializes the error", () => {
      const error = new Error("connection refused");

      const result = prepareForSystemState(
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
    });
  });
});
