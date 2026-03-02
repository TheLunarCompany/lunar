import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { ControlPlaneConfigService } from "../services/control-plane-config-service.js";
import { UpstreamHandler } from "../services/upstream-handler.js";
import { AvailableToolInfo, LLMService, MatchedTool } from "./llm-service.js";
import { ToolGroup, ServiceToolGroup } from "../model/config/permissions.js";
import { AlreadyExistsError, NotFoundError } from "../errors.js";
import { normalizeServerName } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";

export const INTERNAL_SERVICE_NAME = "mcpx";

/**
 * Names of internal tools that can be called.
 * Used for type-safe tool name matching.
 */
export const InternalToolName = {
  GET_NEW_CAPABILITIES: "get_new_capabilities",
  CLEAR_TOOLS: "clear_tools",
} as const;

export type InternalToolNameType =
  (typeof InternalToolName)[keyof typeof InternalToolName];

const GET_NEW_CAPABILITIES_TOOL: Tool = {
  name: InternalToolName.GET_NEW_CAPABILITIES,
  description:
    "IMPORTANT: Call this tool FIRST to unlock tools for your task. " +
    "Without calling this, you won't have access to any other tools." +
    "Formalize the request from the user into a clear intent statement describing the task to accomplish. " +
    "Based on the intent, I will unlock relevant tools to help accomplish the task. " +
    "Then, your tool list will be refreshed with the relevant tools for the task.",
  inputSchema: {
    type: "object" as const,
    properties: {
      intent: {
        type: "string",
        description: "Describe the task you want to accomplish.",
      },
    },
    required: ["intent"],
  },
};

const CLEAR_TOOLS_TOOL: Tool = {
  name: InternalToolName.CLEAR_TOOLS,
  description:
    "Use this tool when you've completed a task and no longer need the specialized tools. " +
    "This reduces noise and helps you focus on new tasks. " +
    "No parameters required - automatically removes all dynamically added tools while keeping core discovery capabilities.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

function getDynamicGroupName(consumerTag: string): string {
  return `${consumerTag}_dynamic`;
}

function groupToolsByServer(tools: MatchedTool[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const tool of tools) {
    const existing = result[tool.serverName];
    if (existing) {
      existing.push(tool.toolName);
    } else {
      result[tool.serverName] = [tool.toolName];
    }
  }
  return result;
}

function formatToolNames(tools: MatchedTool[]): string {
  return tools.map((t) => `${t.serverName}__${t.toolName}`).join(", ");
}

function createInternalOnlyGroup(groupName: string): ToolGroup {
  return {
    name: groupName,
    services: {
      [INTERNAL_SERVICE_NAME]: "*",
    },
    owner: "dynamic-capabilities",
  };
}

function createGroupWithTools(
  groupName: string,
  matchedTools: MatchedTool[],
): ToolGroup {
  const services: Record<string, ServiceToolGroup> =
    groupToolsByServer(matchedTools);
  // Always keep internal tools available
  services[INTERNAL_SERVICE_NAME] = "*";
  return {
    name: groupName,
    services,
    owner: "dynamic-capabilities",
  };
}

export class DynamicCapabilitiesService {
  constructor(
    private configService: ControlPlaneConfigService,
    private upstreamHandler: UpstreamHandler,
    private llmService: LLMService,
    private logger: Logger,
  ) {
    this.logger = logger.child({ component: "DynamicCapabilitiesService" });
  }

  async initialize(): Promise<void> {
    await this.cleanupStaleGroups();
  }

  /**
   * Returns the internal tools that should be exposed in dynamic capabilities mode.
   * These tools are prefixed with the internal service name.
   */
  getInternalTools(): Tool[] {
    const serverNames = Array.from(
      this.upstreamHandler.connectedClientsByService.keys(),
    ).sort();

    const dynamicDescription =
      serverNames.length > 0
        ? `${GET_NEW_CAPABILITIES_TOOL.description} Available servers: ${serverNames.join(", ")}.`
        : GET_NEW_CAPABILITIES_TOOL.description;

    return [
      {
        ...GET_NEW_CAPABILITIES_TOOL,
        name: `${INTERNAL_SERVICE_NAME}__${GET_NEW_CAPABILITIES_TOOL.name}`,
        description: dynamicDescription,
      },
      {
        ...CLEAR_TOOLS_TOOL,
        name: `${INTERNAL_SERVICE_NAME}__${CLEAR_TOOLS_TOOL.name}`,
      },
    ];
  }

  /**
   * Called when dynamic capabilities mode is toggled ON for a consumer.
   * Creates a tool group containing only the internal tools and assigns it to the consumer.
   */
  async initializeDynamicCapabilities(consumerTag: string): Promise<void> {
    const groupName = getDynamicGroupName(consumerTag);
    const group = createInternalOnlyGroup(groupName);

    // Create or update the dynamic tool group
    try {
      await this.configService.addToolGroup({ group });
    } catch (error) {
      if (error instanceof AlreadyExistsError) {
        this.logger.debug("Dynamic group already exists, resetting", {
          consumerTag,
          groupName,
        });
        await this.configService.updateToolGroup({
          name: groupName,
          updates: group,
        });
      } else {
        throw error;
      }
    }

    // Assign the dynamic group to the consumer (block all except dynamic group)
    const existingConsumer = this.configService.getPermissionConsumer({
      name: consumerTag,
    });
    if (existingConsumer) {
      await this.configService.updatePermissionConsumer({
        name: consumerTag,
        config: {
          _type: "default-block",
          allow: [groupName],
        },
      });
    } else {
      await this.configService.addPermissionConsumer({
        name: consumerTag,
        config: {
          _type: "default-block",
          allow: [groupName],
        },
      });
    }

    this.logger.info("Initialized dynamic capabilities", {
      consumerTag,
      groupName,
    });
  }

  /**
   * Called when dynamic capabilities mode is toggled OFF for a consumer.
   * Removes the dynamic tool group.
   */
  async cleanupDynamicCapabilities(consumerTag: string): Promise<void> {
    const groupName = getDynamicGroupName(consumerTag);

    // Remove the consumer permission override (return to default permissions)
    try {
      await this.configService.deletePermissionConsumer({ name: consumerTag });
      this.logger.debug("Removed consumer permission override", {
        consumerTag,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        this.logger.debug("Consumer permission already deleted", {
          consumerTag,
        });
      } else {
        throw error;
      }
    }

    // Delete the dynamic tool group
    try {
      await this.configService.deleteToolGroup({ name: groupName });
      this.logger.info("Cleaned up dynamic capabilities", {
        consumerTag,
        groupName,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        this.logger.debug("Dynamic group already deleted", {
          consumerTag,
          groupName,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle tool calls to internal tools.
   */
  async handleToolCall(params: {
    consumerTag: string;
    toolName: InternalToolNameType;
    args: Record<string, unknown>;
  }): Promise<CallToolResult> {
    const { consumerTag, toolName, args } = params;
    switch (toolName) {
      case InternalToolName.GET_NEW_CAPABILITIES:
        return this.handleGetNewCapabilities(consumerTag, args);
      case InternalToolName.CLEAR_TOOLS:
        return this.handleClearTools(consumerTag);
    }
  }

  /**
   * Check if a tool name is an internal tool.
   */
  isInternalTool(toolName: string): toolName is InternalToolNameType {
    return Object.values(InternalToolName).includes(
      toolName as InternalToolNameType,
    );
  }

  /**
   * Check if dynamic capabilities mode is enabled for a consumer.
   * Mode is enabled if the dynamic tool group exists.
   */
  isDynamicCapabilitiesEnabled(consumerTag: string): boolean {
    const groupName = getDynamicGroupName(consumerTag);
    const config = this.configService.getConfig();
    return config.toolGroups.some((g) => g.name === groupName);
  }

  /**
   * Remove any dynamic-capabilities tool groups that may have been persisted from a previous session.
   * These groups are ephemeral and should not survive restarts.
   */
  private async cleanupStaleGroups(): Promise<void> {
    const config = this.configService.getConfig();
    const dynamicGroups = config.toolGroups.filter(
      (g) => g.owner === "dynamic-capabilities",
    );

    await Promise.all(
      dynamicGroups.map((group) =>
        this.configService
          .deleteToolGroup({ name: group.name })
          .then(() =>
            this.logger.info("Cleaned up stale dynamic-capabilities group", {
              groupName: group.name,
            }),
          )
          .catch((error) =>
            this.logger.warn(
              "Failed to clean up stale dynamic-capabilities group",
              {
                groupName: group.name,
                error,
              },
            ),
          ),
      ),
    );
  }

  private async handleGetNewCapabilities(
    consumerTag: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const intent = args["intent"];
    if (typeof intent !== "string" || !intent.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "Error: intent parameter is required and must be a non-empty string.",
          },
        ],
        isError: true,
      };
    }

    const availableTools = await this.getAllAvailableTools();
    const matchedTools = await this.llmService.matchToolsForIntent(
      intent,
      availableTools,
    );

    const groupName = getDynamicGroupName(consumerTag);
    const group = createGroupWithTools(groupName, matchedTools);

    await this.configService.updateToolGroup({
      name: groupName,
      updates: group,
    });

    this.logger.info("Added tools for consumer", {
      consumerTag,
      intent,
      toolCount: matchedTools.length,
      tools: matchedTools,
    });

    const toolNames = formatToolNames(matchedTools);
    // Config change triggers broadcastToolListChanged automatically
    return {
      content: [
        {
          type: "text",
          text: `${matchedTools.length} tools are now ready to use: ${toolNames}`,
        },
      ],
    };
  }

  private async handleClearTools(consumerTag: string): Promise<CallToolResult> {
    const groupName = getDynamicGroupName(consumerTag);
    const group = createInternalOnlyGroup(groupName);

    await this.configService.updateToolGroup({
      name: groupName,
      updates: group,
    });

    this.logger.info("Cleared tools for consumer", { consumerTag });

    // Config change triggers broadcastToolListChanged automatically
    return {
      content: [{ type: "text", text: "Tools cleared." }],
    };
  }

  /**
   * Get all available tools from connected upstream servers.
   * Same approach as mcp-gateway ListToolsRequest handler.
   */
  private async getAllAvailableTools(): Promise<AvailableToolInfo[]> {
    const result: AvailableToolInfo[] = [];
    const config = this.configService.getConfig();

    const entries = Array.from(
      this.upstreamHandler.connectedClientsByService.entries(),
    ).sort(([a], [b]) => a.localeCompare(b));

    for (const [serviceName, client] of entries) {
      const attributes =
        config.targetServerAttributes[normalizeServerName(serviceName)];
      if (attributes?.inactive) {
        continue;
      }

      const capabilities = client.getServerCapabilities();
      if (capabilities && !capabilities.tools) {
        continue;
      }

      try {
        const toolsResponse = await this.upstreamHandler.listTools(serviceName);
        for (const tool of toolsResponse.tools) {
          result.push({
            serverName: serviceName,
            toolName: tool.name,
            description: tool.description,
          });
        }
      } catch (error) {
        this.logger.debug("Failed to list tools for server", {
          serviceName,
          error: loggableError(error),
        });
      }
    }

    return result;
  }
}
