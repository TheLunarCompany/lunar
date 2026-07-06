import { Tool } from "../model/target-servers.js";

export interface TokenEncoder {
  encode(text: string): number[];
}

// estimatedTokens is only consumed by sandbox-analysis, so other instances use
// this no-op encoder and skip the heavy js-tiktoken load.
export const noOpTokenEncoder: TokenEncoder = { encode: () => [] };

export class ToolTokenEstimator {
  constructor(private encoding: TokenEncoder = noOpTokenEncoder) {}

  // Swaps in the real encoder, loaded lazily after construction.
  setEncoder(encoder: TokenEncoder): void {
    this.encoding = encoder;
  }

  estimateTokens(tool: Tool): number {
    const serialized = JSON.stringify({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
    return this.encoding.encode(serialized).length;
  }
}
