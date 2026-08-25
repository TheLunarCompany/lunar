import {
  Prompt,
  PromptMessage,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
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

export function buildSystemStatePromptsPayload(
  approvedPrompts: Prompt[],
  rawPrompts: Prompt[],
  promptMessages: Record<string, PromptMessage[]> | undefined,
): {
  prompts: TargetServerNewWithoutUsage["prompts"];
  originalPrompts: Prompt[];
} {
  return {
    prompts: approvedPrompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
      messages: promptMessages?.[prompt.name],
    })),
    originalPrompts: rawPrompts,
  };
}

export function prepareForSystemState(
  targetClient: TargetClient,
  estimateTokens: (tool: Tool) => number,
  approvedTools: Tool[] = [],
  originalTools: Tool[] = [],
  approvedPrompts: Prompt[] = [],
  originalPrompts: Prompt[] = [],
  promptMessages?: Record<string, PromptMessage[]>,
): TargetServerNewWithoutUsage {
  switch (targetClient._state) {
    case "connecting":
      return buildSystemStateEntry(targetClient.targetServer, {
        type: "connecting",
      });
    case "connected":
    case "pending-auth":
      return buildSystemStateEntry(
        targetClient.targetServer,
        { type: targetClient._state },
        {
          ...buildSystemStateToolsPayload(
            approvedTools,
            originalTools,
            estimateTokens,
          ),
          ...buildSystemStatePromptsPayload(
            approvedPrompts,
            originalPrompts,
            promptMessages,
          ),
        },
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
    prompts: TargetServerNewWithoutUsage["prompts"];
    originalPrompts: TargetServerNewWithoutUsage["originalPrompts"];
  },
): TargetServerNewWithoutUsage {
  const common = {
    state,
    tools: overrides?.tools ?? [],
    originalTools: overrides?.originalTools ?? [],
    prompts: overrides?.prompts ?? [],
    originalPrompts: overrides?.originalPrompts ?? [],
  };
  // Per-branch construction (not a cast) so each server type is checked against
  // its own member: a new required field fails to compile until it's set here.
  switch (targetServer.type) {
    case "stdio":
      return { _type: "stdio", ...targetServer, ...common };
    case "sse":
      return { _type: "sse", ...targetServer, ...common };
    case "streamable-http":
      return { _type: "streamable-http", ...targetServer, ...common };
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
