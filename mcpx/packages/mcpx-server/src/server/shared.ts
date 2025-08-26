import { compact, compactRecord } from "@mcpx/toolkit-core/data";
import { measureNonFailable } from "@mcpx/toolkit-core/time";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { IncomingHttpHeaders } from "http";
import { Logger } from "winston";
import z from "zod/v4";
import { AuditLogEvent } from "../model/audit-log-type.js";
import { McpxSession } from "../model/sessions.js";
import { Services } from "../services/services.js";

const PING_TIMEOUT_FACTOR = 0.8;

// This utility function is used to scope client names that should be ignored.
// This is required since some clients (e.g. `mcp-remote`) might initiate
// a "probe" connection to the server, to detect if it's up/requires auth.
// Responsible clients might do this by a designated client name,
// which we can detect and handle accordingly.
const probeClientNames = new Set(["mcp-remote-fallback-test"]);
export function isProbeClient(clientName?: string): boolean {
  if (!clientName) {
    return false;
  }
  return probeClientNames.has(clientName);
}
const SERVICE_DELIMITER = "__";

const requestBodySchema = z.object({
  params: z.object({
    protocolVersion: z.string(),
    clientInfo: z.object({ name: z.string(), version: z.string() }),
  }),
});

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

export function extractMetadata(
  headers: IncomingHttpHeaders,
  body: unknown,
): McpxSession["metadata"] {
  const consumerTag = headers["x-lunar-consumer-tag"] as string | undefined;
  const llmProvider = headers["x-lunar-llm-provider"] as string | undefined;
  const llmModelId = headers["x-lunar-llm-model-id"] as string | undefined;
  // generate a unique id for the client
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const llm =
    llmProvider && llmModelId
      ? { provider: llmProvider, modelId: llmModelId }
      : undefined;

  const parsedBody = requestBodySchema.safeParse(body);
  let clientInfo: McpxSession["metadata"]["clientInfo"] | undefined = undefined;
  if (parsedBody.success) {
    clientInfo = {
      protocolVersion: parsedBody.data.params.protocolVersion,
      name: parsedBody.data.params.clientInfo.name,
      version: parsedBody.data.params.clientInfo.version,
    };
  }
  const isProbe = isProbeClient(clientInfo?.name);
  return { consumerTag, llm, clientInfo, clientId, isProbe };
}

export function setupPingMonitoring(
  server: Server,
  transport: Transport,
  sessionId: string,
  metadata: McpxSession["metadata"],
  options: {
    pingIntervalMs: number;
    maxMissedPings: number;
  },
  logger: Logger,
): () => void {
  const { pingIntervalMs, maxMissedPings } = options;
  const pingTimeoutMs = Math.floor(pingIntervalMs * PING_TIMEOUT_FACTOR);
  let missedPings = 0;

  const executePingWithTimeout = async (): Promise<boolean> => {
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), pingTimeoutMs);
    });

    const pingPromise = server
      .ping()
      .then(() => true)
      .catch(() => false);

    return Promise.race([pingPromise, timeoutPromise]);
  };

  let pingInProgress = false;

  const interval = setInterval(async (): Promise<void> => {
    if (pingInProgress) {
      logger.silly("Skipping ping, previous ping still in progress");
      return;
    }
    pingInProgress = true;
    const pong = await executePingWithTimeout().then((success) => {
      if (success) {
        logger.silly("Ping successful", { metadata });
      } else {
        logger.debug("Ping failed or timed out", { metadata });
      }
      return success;
    });

    if (!pong) {
      missedPings += 1;
      if (missedPings >= maxMissedPings) {
        logger.debug(
          `Missed ${maxMissedPings} consecutive pings, closing transport`,
          { sessionId, metadata },
        );
        await transport.close();
      }
    } else {
      missedPings = 0;
    }

    pingInProgress = false;
    logger.silly("Ping check complete", {
      metadata,
      pong,
      missedPings,
    });
  }, pingIntervalMs);

  let stopped = false;
  return () => {
    if (stopped) {
      return;
    }
    logger.debug("Stopping ping monitoring", { sessionId, metadata });
    clearInterval(interval);
    stopped = true;
  };
}

export function scheduleProbeTransportTermination(
  services: Services,
  server: Server,
  transport: Transport,
  options: {
    probeClientsGraceLivenessPeriodMs: number;
  },
  stopPing: () => void,
): void {
  setTimeout(async () => {
    await server.close().catch(() => {
      // Ignore errors on close
    });
    if (transport.sessionId) {
      services.sessions.removeSession(transport.sessionId);
    }
    stopPing();
  }, options.probeClientsGraceLivenessPeriodMs);
}
