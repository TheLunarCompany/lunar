import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { TargetServer } from "../model/target-servers.js";
import { extractToolParameters } from "./client-extension.js";
import { TargetServerNewWithoutUsage } from "./system-state.js";
import { TargetClient } from "./target-client-types.js";

// Single site that pairs approved+enriched `tools` with raw `originalTools`
// so the two can't get inverted.
export function buildSystemStateToolsPayload(
  approvedTools: Tool[],
  rawTools: Tool[],
  estimateTokens: (tool: Tool) => number,
): {
  tools: TargetServerNewWithoutUsage["tools"];
  originalTools: Tool[];
} {
  return {
    tools: approvedTools.map((tool) => ({
      ...tool,
      parameters: extractToolParameters(tool),
      estimatedTokens: estimateTokens(tool),
    })),
    originalTools: rawTools,
  };
}

export function prepareForSystemState(
  targetClient: TargetClient,
  estimateTokens: (tool: Tool) => number,
  approvedTools: Tool[] = [],
  originalTools: Tool[] = [],
): TargetServerNewWithoutUsage {
  switch (targetClient._state) {
    case "connecting":
      return buildSystemStateEntry(targetClient.targetServer, {
        type: "connecting",
      });
    case "connected":
      return buildSystemStateEntry(
        targetClient.targetServer,
        { type: "connected" },
        buildSystemStateToolsPayload(
          approvedTools,
          originalTools,
          estimateTokens,
        ),
      );
    case "pending-auth":
      return buildSystemStateEntry(
        targetClient.targetServer,
        { type: "pending-auth" },
        buildSystemStateToolsPayload(
          approvedTools,
          originalTools,
          estimateTokens,
        ),
      );
    case "pending-input":
      return buildSystemStateEntry(targetClient.targetServer, {
        type: "pending-input",
        missingEnvVars: targetClient.missingEnvVars,
      });
    case "connection-failed":
      return buildSystemStateEntry(targetClient.targetServer, {
        type: "connection-failed",
        error: prepareError(targetClient.error),
      });
  }
}

function buildSystemStateEntry(
  targetServer: TargetServer,
  state: TargetServerNewWithoutUsage["state"],
  overrides?: {
    tools: TargetServerNewWithoutUsage["tools"];
    originalTools: TargetServerNewWithoutUsage["originalTools"];
  },
): TargetServerNewWithoutUsage {
  const tools = overrides?.tools ?? [];
  const originalTools = overrides?.originalTools ?? [];
  switch (targetServer.type) {
    case "stdio":
      return { _type: "stdio", state, ...targetServer, tools, originalTools };
    case "sse":
      return { _type: "sse", state, ...targetServer, tools, originalTools };
    case "streamable-http":
      return {
        _type: "streamable-http",
        state,
        ...targetServer,
        tools,
        originalTools,
      };
  }
}

export function prepareError(error: Error): {
  name: string;
  message: string;
} {
  return {
    name: error.name,
    message: error.message,
  };
}
