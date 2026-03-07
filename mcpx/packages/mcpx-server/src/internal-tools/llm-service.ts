import { z } from "zod/v4";
import { Logger } from "winston";
import { HubService } from "../services/hub.js";

// Input: available tools that can be matched
export interface AvailableToolInfo {
  serverName: string;
  toolName: string;
  description?: string;
}

// Output: tools matched by LLM for the given intent
export const matchedToolSchema = z.object({
  serverName: z.string(),
  toolName: z.string(),
});

export type MatchedTool = z.infer<typeof matchedToolSchema>;

export interface LLMService {
  matchToolsForIntent(
    intent: string,
    availableTools: AvailableToolInfo[],
  ): Promise<MatchedTool[]>;
}

// ============================================================================
// Prompts
// ============================================================================

const DYNAMIC_CAPABILITIES_MATCHING_SYSTEM_PROMPT = `You are a tool matching assistant. Given a user's intent and a list of available tools, select the tools that are most relevant to accomplish the user's task.

Return ONLY the tools that are directly needed. Be selective - don't include tools that are tangentially related.

Output a JSON object with a "tools" array containing objects with "serverName" and "toolName" fields.`;

function buildToolMatchingUserMessage(
  intent: string,
  tools: AvailableToolInfo[],
): string {
  const toolList = tools
    .map(
      (t) =>
        `- ${t.serverName}/${t.toolName}: ${t.description ?? "No description"}`,
    )
    .join("\n");

  return `User intent: "${intent}"

Available tools:
${toolList}

Select the tools needed to accomplish this intent.`;
}

// ============================================================================
// Implementations
// ============================================================================

/**
 * Standalone LLM service - unsupported, dynamic capabilities require Hub.
 */
export class DirectLLMService implements LLMService {
  async matchToolsForIntent(): Promise<MatchedTool[]> {
    throw new Error(
      "Dynamic capabilities matching requires enterprise mode with Hub connection.",
    );
  }
}

/**
 * Enterprise LLM service that proxies requests through Hub.
 */
export class HubLLMService implements LLMService {
  private logger: Logger;

  constructor(
    private hubService: HubService,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "HubLLMService" });
  }

  async matchToolsForIntent(
    intent: string,
    availableTools: AvailableToolInfo[],
  ): Promise<MatchedTool[]> {
    this.logger.debug("Matching tools for intent via Hub", {
      intent,
      toolCount: availableTools.length,
    });

    const response = await this.hubService.emitDynamicCapabilitiesMatching({
      systemPrompt: DYNAMIC_CAPABILITIES_MATCHING_SYSTEM_PROMPT,
      userMessage: buildToolMatchingUserMessage(intent, availableTools),
    });

    switch (response.status) {
      case "success":
        this.logger.debug("Received matched tools from Hub", {
          matchedCount: response.result.tools.length,
        });
        return response.result.tools;
      case "error":
        this.logger.error(
          "Hub returned error for dynamic capabilities matching",
          {
            error: response.error,
          },
        );
        throw new Error(
          `Dynamic capabilities matching failed: ${response.error}`,
        );
      case "unsupported":
        this.logger.warn("Hub does not support dynamic capabilities matching");
        throw new Error("Dynamic capabilities matching is not enabled.");
    }
  }
}

export interface LLMServiceFactoryDeps {
  isEnterprise: boolean;
  hubService: HubService;
  logger: Logger;
}

export function createLLMService(deps: LLMServiceFactoryDeps): LLMService {
  if (deps.isEnterprise) {
    return new HubLLMService(deps.hubService, deps.logger);
  }
  return new DirectLLMService();
}
