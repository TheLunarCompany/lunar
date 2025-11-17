import { compact, compactRecord } from "@mcpx/toolkit-core/data";
import { measureNonFailable } from "@mcpx/toolkit-core/time";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { Logger } from "winston";
import { AuditLogEvent } from "../model/audit-log-type.js";
import { Services } from "../services/services.js";

const SERVICE_DELIMITER = "__";

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
  const server = new Server(
    { name: "mcpx", version: "1.0.0" },
    { capabilities: { tools: {} } },
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
                  serviceName.trim().toLowerCase()
                ];
              if (attributes?.inactive) {
                logger.debug("Skipping tools from inactive target server", {
                  serviceName,
                });
                return [];
              }
              const { tools } = await client.listTools();
              return compact(
                tools.map((tool) => {
                  const hasPermission =
                    services.permissionManager.hasPermission({
                      serviceName,
                      toolName: tool.name,
                      consumerTag,
                    });
                  if (!hasPermission) {
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
          serviceName.trim().toLowerCase()
        ];
      if (attributes?.inactive) {
        logger.debug("Attempt to call tool from inactive target server", {
          serviceName,
          toolName,
        });
        throw new Error(`Target server ${serviceName} is inactive`);
      }
      const hasPermission = services.permissionManager.hasPermission({
        serviceName,
        toolName,
        consumerTag,
      });
      if (!hasPermission) {
        throw new Error("Permission denied");
      }

      const client =
        services.targetClients.connectedClientsByService.get(serviceName);
      if (!client) {
        logger.error("Client not found for service", {
          serviceName,
          sessionId,
        });
        throw new Error(`Client not found for service: ${serviceName}`);
      }

      const measureToolCallResult = await measureNonFailable(async () => {
        const result = await client.callTool({
          name: toolName,
          arguments: request.params.arguments,
        });

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
