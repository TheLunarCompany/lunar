import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../logger.js";
import { Services } from "../services/services.js";
import { compact } from "../utils.js";
import express from "express";

const SERVICE_DELIMITER = "__";

export function getServer(services: Services): Server {
  const server = new Server(
    { name: "mcpx", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request, { sessionId }) => {
      logger.info("ListToolsRequest received", { sessionId });
      const consumerTag = sessionId
        ? services.sessions[sessionId]?.consumerTag
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
        ? services.sessions[sessionId]?.consumerTag
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
      return await client.callTool({
        name: toolName,
        arguments: request.params.arguments,
      });
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
