import {
  compact,
  compactRecord,
  normalizeServerName,
} from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { measureNonFailable } from "@mcpx/toolkit-core/time";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { Logger } from "winston";
import { env } from "../env.js";
import { AuditLogEvent } from "../model/audit-log-type.js";
import { Services } from "../services/services.js";

const SERVICE_DELIMITER = "__";

function hasUserPermission(
  services: Services,
  serviceName: string,
  toolName: string,
  consumerTag?: string,
): boolean {
  // Catalog-level approval is handled in ExtendedClient
  // This function only checks user-configured permissions
  return services.permissionManager.hasPermission({
    serviceName,
    toolName,
    consumerTag,
  });
}

// A function to get the server instance for a given session.
// If `shouldReturnEmptyServer` is true, it returns an empty server instance.
// This is done in order to handle a hack in `mcp-remote`,
// which is currently the recommended way to connect to the MCPX server
// from clients that support STDIO transport only.
export async function getServer(
  services: Services,
  logger: Logger,
  shouldReturnEmptyServer: boolean,
): Promise<Server> {
  const capabilities = env.ENABLE_PROMPT_CAPABILITY
    ? { tools: {}, prompts: {} }
    : { tools: {} };
  const server = new Server(
    { name: "mcpx", version: "1.0.0" },
    { capabilities },
  );
  if (shouldReturnEmptyServer) {
    return server;
  }

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request, { sessionId }) => {
      logger.info("ListToolsRequest received", { sessionId });
      const consumerTag = sessionId
        ? services.sessions.getSession(sessionId)?.metadata.consumerTag
        : undefined;

      const allTools = (
        await Promise.all(
          Array.from(services.targetClients.connectedClientsByService.entries())
            .sort(([a], [b]) => a.localeCompare(b)) // Sort by service name to ensure consistent order
            .flatMap(async ([serviceName, client]) => {
              const attributes =
                services.config.getConfig().targetServerAttributes[
                  normalizeServerName(serviceName)
                ];
              if (attributes?.inactive) {
                logger.debug("Skipping tools from inactive target server", {
                  serviceName,
                });
                return [];
              }
              const capabilities = client.getServerCapabilities();
              if (capabilities && !capabilities.tools) {
                logger.debug("Skipping tools for unsupported target server", {
                  serviceName,
                });
                return [];
              }
              const toolsResponse = await services.targetClients
                .listTools(serviceName)
                .catch((error) => {
                  logger.warn("Failed to list tools for target server", {
                    serviceName,
                    error: loggableError(error),
                  });
                  return null;
                });
              if (!toolsResponse) {
                return [];
              }
              const { tools } = toolsResponse;
              return compact(
                tools.map((tool) => {
                  if (
                    !hasUserPermission(
                      services,
                      serviceName,
                      tool.name,
                      consumerTag,
                    )
                  ) {
                    return null;
                  }
                  return {
                    ...tool,
                    name: `${serviceName}${SERVICE_DELIMITER}${tool.name}`,
                  };
                }),
              );
            }),
        )
      ).flat();
      if (logger.isSillyEnabled()) {
        logger.debug("ListToolsRequest response", { allTools });
      } else {
        logger.debug("ListToolsRequest response", {
          toolCount: allTools.length,
        });
      }
      return { tools: allTools };
    },
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, { sessionId }) => {
      logger.debug("CallToolRequest params", {
        request: request.params,
        sessionId,
      });
      const consumerTag = sessionId
        ? services.sessions.getSession(sessionId)?.metadata.consumerTag
        : undefined;

      const [serviceName, ...toolNamePars] =
        request?.params?.name?.split(SERVICE_DELIMITER) || [];
      if (!serviceName) {
        throw new Error("Invalid service name");
      }
      const toolName = toolNamePars.join(SERVICE_DELIMITER);
      if (!toolName) {
        throw new Error("Invalid tool name");
      }
      const attributes =
        services.config.getConfig().targetServerAttributes[
          normalizeServerName(serviceName)
        ];
      if (attributes?.inactive) {
        logger.debug("Attempt to call tool from inactive target server", {
          serviceName,
          toolName,
        });
        throw new Error(`Target server ${serviceName} is inactive`);
      }
      if (!hasUserPermission(services, serviceName, toolName, consumerTag)) {
        throw new Error("Permission denied");
      }

      const measureToolCallResult = await measureNonFailable(async () => {
        const result = await services.targetClients.callTool(
          serviceName,
          toolName,
          request.params.arguments,
        );

        services.systemStateTracker.recordToolCall({
          targetServerName: serviceName,
          toolName,
          sessionId,
        });
        const toolUsedEvent: AuditLogEvent = {
          eventType: "tool_used",
          payload: {
            toolName,
            targetServerName: serviceName,
            args: request.params.arguments || undefined,
            consumerTag: consumerTag || undefined,
          },
        };
        // Audit log the tool usage
        services.auditLog.log(toolUsedEvent);

        return result;
      });

      // Prepare metric labels and record the tool call duration
      const sessionMeta = sessionId
        ? services.sessions.getSession(sessionId)?.metadata
        : undefined;

      const isError =
        !measureToolCallResult.success ||
        // Type inference for `.isError` fails, but it is indeed a boolean
        Boolean(measureToolCallResult.result.isError);

      const labels: Record<string, string | undefined> = {
        "tool-name": toolName,
        error: isError.toString(),
        agent: consumerTag,
        llm: sessionMeta?.llm?.provider,
        model: sessionMeta?.llm?.modelId,
      };

      services.metricRecorder.recordToolCallDuration(
        measureToolCallResult.duration,
        compactRecord(labels),
      );

      if (measureToolCallResult.success) {
        return measureToolCallResult.result;
      }
      return Promise.reject(measureToolCallResult.error);
    },
  );

  if (!env.ENABLE_PROMPT_CAPABILITY) {
    return server;
  }

  // Prompt capability (feature flag) is enabled
  server.setRequestHandler(
    ListPromptsRequestSchema,
    async (_request, { sessionId }) => {
      logger.info("ListPromptsRequest received", { sessionId });
      const allPrompts = (
        await Promise.all(
          Array.from(services.targetClients.connectedClientsByService.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(async ([serviceName, client]) => {
              const attributes =
                services.config.getConfig().targetServerAttributes[
                  normalizeServerName(serviceName)
                ];
              if (attributes?.inactive) {
                logger.debug("Skipping prompts from inactive target server", {
                  serviceName,
                });
                return [];
              }
              const capabilities = client.getServerCapabilities();
              if (capabilities && !capabilities.prompts) {
                logger.debug("Skipping prompts for unsupported target server", {
                  serviceName,
                });
                return [];
              }
              const promptsResponse = await services.targetClients
                .listPrompts(serviceName)
                .catch((error) => {
                  logger.warn("Failed to list prompts for target server", {
                    serviceName,
                    error: loggableError(error),
                  });
                  return null;
                });
              if (!promptsResponse) {
                return [];
              }
              const { prompts } = promptsResponse;
              return compact(
                prompts.map((prompt) => {
                  return {
                    ...prompt,
                    name: `${serviceName}${SERVICE_DELIMITER}${prompt.name}`,
                  };
                }),
              );
            }),
        )
      ).flat();

      logger.debug("ListPromptsRequest response", {
        promptCount: allPrompts.length,
      });
      return { prompts: allPrompts };
    },
  );

  server.setRequestHandler(
    GetPromptRequestSchema,
    async (request, { sessionId }) => {
      logger.debug("GetPromptRequest params", {
        request: request.params,
        sessionId,
      });
      const [serviceName, ...promptNamePars] =
        request?.params?.name?.split(SERVICE_DELIMITER) || [];
      if (!serviceName) {
        throw new Error("Invalid service name");
      }
      const promptName = promptNamePars.join(SERVICE_DELIMITER);
      if (!promptName) {
        throw new Error("Invalid prompt name");
      }
      const attributes =
        services.config.getConfig().targetServerAttributes[
          normalizeServerName(serviceName)
        ];
      if (attributes?.inactive) {
        logger.debug("Attempt to get prompt from inactive target server", {
          serviceName,
          promptName,
        });
        throw new Error(`Target server ${serviceName} is inactive`);
      }
      const client = services.targetClients.connectedClientsByService.get(
        normalizeServerName(serviceName),
      );
      if (!client) {
        logger.error("Client not found for service", {
          serviceName,
          sessionId,
        });
        throw new Error(`Client not found for service: ${serviceName}`);
      }
      const capabilities = client.getServerCapabilities();
      if (capabilities && !capabilities.prompts) {
        throw new Error(`Target server ${serviceName} has no prompts`);
      }
      return await services.targetClients.getPrompt(
        serviceName,
        promptName,
        request.params.arguments,
      );
    },
  );
  return server;
}

function createMcpErrorMessage(message: string): object {
  return {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message,
    },
    id: null,
  };
}

export function respondTransportMismatch(res: express.Response): void {
  res
    .status(400)
    .json(createMcpErrorMessage("Bad Request: Transport type mismatch"));
}

export function respondNoValidSessionId(res: express.Response): void {
  res
    .status(404)
    .json(createMcpErrorMessage("Bad Request: No valid session ID provided"));
}
