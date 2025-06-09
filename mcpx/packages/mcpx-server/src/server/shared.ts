import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { mcpxLogger } from "../logger.js";
import { Services } from "../services/services.js";
import { compact } from "../utils/data.js";
import express from "express";
import { IncomingHttpHeaders } from "http";
import { McpxSession } from "../model.js";

const SERVICE_DELIMITER = "__";

export function getServer(services: Services): Server {
  const server = new Server(
    { name: "mcpx", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request, { sessionId }) => {
      mcpxLogger.info("ListToolsRequest received", { sessionId });
      const consumerTag = sessionId
        ? services.sessions.getSession(sessionId)?.metadata.consumerTag
        : undefined;
      const allTools = (
        await Promise.all(
          Array.from(services.targetClients.clientsByService.entries()).flatMap(
            async ([serviceName, client]) => {
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
            },
          ),
        )
      ).flat();
      mcpxLogger.debug("ListToolsRequest response", { allTools });
      return { tools: allTools };
    },
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, { sessionId }) => {
      mcpxLogger.info("CallToolRequest received", {
        method: request.method,
        sessionId,
      });
      mcpxLogger.debug("CallToolRequest params", { request: request.params });
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

      // Start timing
      const startTime = Date.now();

      // Prepare metric labels
      const sessionMeta = sessionId
        ? services.sessions.getSession(sessionId)?.metadata
        : undefined;
      let error = false;
      const llm = sessionMeta?.llm?.provider;
      const model = sessionMeta?.llm?.modelId;

      try {
        const result = await client.callTool({
          name: toolName,
          arguments: request.params.arguments,
        });

        services.metricRecorder.recordToolCall({
          targetServerName: serviceName,
          toolName,
          sessionId,
        });
        return result;
      } catch (err) {
        error = true;
        throw err;
      } finally {
        // Calculate call duration and assign duration bucket
        const durationMs = Date.now() - startTime;
        const labels: Record<string, string> = {
          "tool-name": toolName,
          error: error.toString(),
          agent: consumerTag || "",
        };
        if (llm) labels["llm"] = llm;
        if (model) labels["model"] = model;
        if (consumerTag) labels["agent"] = consumerTag;

        services.metricRecorder.recordToolCallDuration(durationMs, labels);
      }
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
