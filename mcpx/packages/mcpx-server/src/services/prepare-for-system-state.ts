import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { TargetServer } from "../model/target-servers.js";
import { extractToolParameters } from "./client-extension.js";
import { TargetServerNewWithoutUsage } from "./system-state.js";
import { TargetClient } from "./target-client-types.js";

export async function prepareForSystemState(
  targetClient: TargetClient,
  estimateTokens: (tool: Tool) => number,
): Promise<TargetServerNewWithoutUsage> {
  switch (targetClient._state) {
    case "connecting":
      return buildSystemStateEntry(targetClient.targetServer, {
        type: "connecting",
      });
    case "connected": {
      const { extendedClient, targetServer } = targetClient;
      const { tools } = await extendedClient.listTools();
      const { tools: originalTools } = await extendedClient.originalTools();

      const enrichedTools = tools.map((tool) => ({
        ...tool,
        parameters: extractToolParameters(tool),
        estimatedTokens: estimateTokens(tool),
      }));

      return buildSystemStateEntry(
        targetServer,
        { type: "connected" },
        { tools: enrichedTools, originalTools },
      );
    }
    case "pending-auth":
      return buildSystemStateEntry(targetClient.targetServer, {
        type: "pending-auth",
      });
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
  stack: string | undefined;
} {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}
