import { describe, it, expect } from "@jest/globals";
import { getEncoding } from "js-tiktoken";
import { ToolTokenEstimator, TokenEncoder } from "./tool-token-estimator.js";
import { DEFAULT_TOKENIZER_ENCODING, TokenizerEncoding } from "../env.js";
import { Tool } from "../model/target-servers.js";

describe("ToolTokenEstimator", () => {
  describe("mechanics", () => {
    it("returns the length of encoded tokens", () => {
      const mockEncoder: TokenEncoder = {
        encode: () => [1, 2, 3, 4, 5],
      };
      const estimator = new ToolTokenEstimator(mockEncoder);

      const tool: Tool = {
        name: "test-tool",
        description: "A test tool",
        inputSchema: { type: "object" },
      };

      expect(estimator.estimateTokens(tool)).toBe(5);
    });

    it("serializes tool name, description, and inputSchema", () => {
      let capturedInput = "";
      const capturingEncoder: TokenEncoder = {
        encode: (text: string) => {
          capturedInput = text;
          return [];
        },
      };
      const estimator = new ToolTokenEstimator(capturingEncoder);

      const tool: Tool = {
        name: "my-tool",
        description: "Does something",
        inputSchema: {
          type: "object",
          properties: { foo: { type: "string" } },
        },
      };

      estimator.estimateTokens(tool);

      const parsed = JSON.parse(capturedInput);
      expect(parsed).toEqual({
        name: "my-tool",
        description: "Does something",
        inputSchema: {
          type: "object",
          properties: { foo: { type: "string" } },
        },
      });
    });

    it("handles missing description", () => {
      let capturedInput = "";
      const capturingEncoder: TokenEncoder = {
        encode: (text: string) => {
          capturedInput = text;
          return [1];
        },
      };
      const estimator = new ToolTokenEstimator(capturingEncoder);

      const tool: Tool = {
        name: "no-desc-tool",
        inputSchema: { type: "object" },
      };

      const result = estimator.estimateTokens(tool);

      expect(result).toBe(1);
      const parsed = JSON.parse(capturedInput);
      expect(parsed.description).toBeUndefined();
    });
  });

  describe("default encoding validation", () => {
    const sampleTool: Tool = {
      name: "read_file",
      description: "Reads the contents of a file from the filesystem",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "The file path to read" },
          encoding: { type: "string", default: "utf-8" },
        },
        required: ["path"],
      },
    };

    const allEncodings = Object.values(TokenizerEncoding);

    it("uses cl100k_base as the default encoding", () => {
      expect(DEFAULT_TOKENIZER_ENCODING).toBe("cl100k_base");
    });

    it("all encodings produce similar token counts within acceptable distance", () => {
      const maxRelativeDifference = 0.1; // Considering 1 = 100% difference

      const results = allEncodings.map((encoding) => {
        const estimator = new ToolTokenEstimator(getEncoding(encoding));
        return {
          encoding,
          tokens: estimator.estimateTokens(sampleTool),
        };
      });

      const defaultResult = results.find(
        (r) => r.encoding === DEFAULT_TOKENIZER_ENCODING,
      );
      expect(defaultResult).toBeDefined();

      for (const result of results) {
        const difference = Math.abs(result.tokens - defaultResult!.tokens);
        const relativeDifference = difference / defaultResult!.tokens;

        expect(relativeDifference).toBeLessThanOrEqual(maxRelativeDifference);
      }
    });

    it("all encodings produce non-zero token counts", () => {
      for (const encoding of allEncodings) {
        const estimator = new ToolTokenEstimator(getEncoding(encoding));
        const tokens = estimator.estimateTokens(sampleTool);

        expect(tokens).toBeGreaterThan(0);
      }
    });
  });
});
