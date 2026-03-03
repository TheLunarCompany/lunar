import { Tool } from "../model/target-servers.js";

export interface TokenEncoder {
  encode(text: string): number[];
}

export class ToolTokenEstimator {
  constructor(private readonly encoding: TokenEncoder) {}

  estimateTokens(tool: Tool): number {
    const serialized = JSON.stringify({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
    return this.encoding.encode(serialized).length;
  }
}
