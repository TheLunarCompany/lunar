import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Services } from "../services/services.js";
import express from "express";
import { IncomingHttpHeaders } from "http";
import { McpxSession } from "../model.js";
import { compact, compactRecord } from "@mcpx/toolkit-core/data";
import { measureNonFailable } from "@mcpx/toolkit-core/time";
import { Logger } from "winston";

const SERVICE_DELIMITER = "__";

export function getServer(services: Services, logger: Logger): Server {
  const server = new Server(
    { name: "mcpx", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request, { sessionId }) => {
      logger.info("ListToolsRequest received", { sessionId });
      const consumerTag = sessionId
        ? services.sessions.getSession(sessionId)?.metadata.consumerTag
        : undefined;
      const allTools = (
        await Promise.all(
          Array.from(services.targetClients.clientsByService.entries())
            .sort(([a], [b]) => a.localeCompare(b)) // Sort by service name to ensure consistent order
            .flatMap(async ([serviceName, client]) => {
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
      logger.debug("ListToolsRequest response", { allTools });
      return { tools: allTools };
    },
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, { sessionId }) => {
      logger.info("CallToolRequest received", {
        method: request.method,
        sessionId,
      });
      logger.debug("CallToolRequest params", { request: request.params });
      const consumerTag = sessionId
        ? services.sessions.getSession(sessionId)?.metadata.consumerTag
        : undefined;

      const [serviceName, toolName] =
        request?.params?.name?.split(SERVICE_DELIMITER) || [];
      if (!serviceName) {
        throw new Error("Invalid service name");
      }
      if (!toolName) {
        throw new Error("Invalid tool name");
      }
      const hasPermission = services.permissionManager.hasPermission({
        serviceName,
        toolName,
        consumerTag,
      });
      if (!hasPermission) {
        throw new Error("Permission denied");
      }
      const client = services.targetClients.clientsByService.get(serviceName);
      if (!client) {
        throw new Error("Client not found");
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
    .status(400)
    .json(createMcpErrorMessage("Bad Request: No valid session ID provided"));
}

export function extractMetadata(
  headers: IncomingHttpHeaders,
): McpxSession["metadata"] {
  const consumerTag = headers["x-lunar-consumer-tag"] as string | undefined;
  const llmProvider = headers["x-lunar-llm-provider"] as string | undefined;
  const llmModelId = headers["x-lunar-llm-model-id"] as string | undefined;

  const llm =
    llmProvider && llmModelId
      ? { provider: llmProvider, modelId: llmModelId }
      : undefined;

  return { consumerTag, llm };
}
