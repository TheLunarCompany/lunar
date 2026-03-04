import { z } from "zod/v4";
import { HubService } from "../services/hub.js";

const TESTING_TOOLS = [
  { serverName: "slack", toolName: "slack_list_channels" },
  { serverName: "slack", toolName: "slack_post_message" },
  { serverName: "time", toolName: "get_current_time" },
];

// Input: available tools that can be matched
export interface AvailableToolInfo {
  serverName: string;
  toolName: string;
  description?: string;
}

// Output: tools matched by LLM for the given intent
// This schema will be exposed in webapp-shared-model for Hub to use
export const matchedToolSchema = z.object({
  serverName: z.string(),
  toolName: z.string(),
});

export const toolMatchingResponseSchema = z.object({
  tools: z.array(matchedToolSchema),
});

export type MatchedTool = z.infer<typeof matchedToolSchema>;
export type ToolMatchingResponse = z.infer<typeof toolMatchingResponseSchema>;

export interface LLMService {
  matchToolsForIntent(
    intent: string,
    availableTools: AvailableToolInfo[],
  ): Promise<MatchedTool[]>;
}

/**
 * Standalone LLM service that calls LLM providers directly.
 * MCP-731 will implement actual provider integration (OpenAI, Anthropic, etc.)
 * Currently returns hardcoded mock response for testing.
 */
export class DirectLLMService implements LLMService {
  async matchToolsForIntent(
    _intent: string,
    _availableTools: AvailableToolInfo[],
  ): Promise<MatchedTool[]> {
    // TODO MCP-731: Implement direct LLM provider calls
    // For now: return hardcoded mock for testing
    return TESTING_TOOLS;
  }
}

/**
 * Enterprise LLM service that proxies requests through Hub.
 *
 * MCP-731 will implement the actual Hub integration:
 * - Emit "llm-completion" event to Hub with:
 *   - messages: prompt with intent + available tools
 *   - responseSchema: "tool-matching" (enum value from webapp-shared-model)
 * - Await "llm-completion-result" with structured response (or wait for ack for sync response)
 * - If responseSchema not supplied, Hub returns default unstructured response
 *
 * Currently returns hardcoded mock response for testing.
 */
export class HubLLMService implements LLMService {
  constructor(private hubService: HubService) {}

  async matchToolsForIntent(
    _intent: string,
    _availableTools: AvailableToolInfo[],
  ): Promise<MatchedTool[]> {
    // TODO MCP-731: Implement actual Hub integration
    //
    // const response = await this.hubService.emitWithAck("llm-completion", {
    //   messages: [{ role: "user", content: buildPrompt(intent, availableTools) }],
    //   responseSchema: "tool-matching", // enum from webapp-shared-model
    // });
    //
    // const parsed = toolMatchingResponseSchema.safeParse(response.result);
    // if (!parsed.success) {
    //   throw new Error("Invalid LLM response format");
    // }
    // return parsed.data.tools;

    // For now: return hardcoded mock for testing
    const neverTrue = 1 > 2;
    if (neverTrue) {
      // only to satisfy TypeScript that hubService is used, since it's not yet implemented
      console.log(this.hubService.status);
    }
    return TESTING_TOOLS;
  }
}

export interface LLMServiceFactoryDeps {
  isEnterprise: boolean;
  hubService: HubService;
}

export function createLLMService(deps: LLMServiceFactoryDeps): LLMService {
  if (deps.isEnterprise) {
    return new HubLLMService(deps.hubService);
  }
  return new DirectLLMService();
}
