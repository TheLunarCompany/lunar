import {
  compact,
  compactRecord,
  makeError,
  normalizeServerName,
} from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { measureNonFailable } from "@mcpx/toolkit-core/time";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  EmptyResultSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { Logger } from "winston";
import { env } from "../env.js";
import { AuditLogEvent } from "../model/audit-log-type.js";
import { Services } from "../services/services.js";
import {
  McpxSession,
  ToolCallCacheEntry,
  ToolCallResultUnion,
} from "../model/sessions.js";

const SERVICE_DELIMITER = "__";
const MIN_PROTOCOL_VERSION_FOR_KEEPALIVE = "2025-11-25";
const MAX_KEEPALIVE_TIMEOUT_RATIO = 0.8;
type RequestHandler = Parameters<Server["setRequestHandler"]>[1];
type Extra = Parameters<RequestHandler>[1];
type SendRequest = Extra["sendRequest"];
type SendNotification = Extra["sendNotification"];

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
    async (request, { sessionId, sendNotification, sendRequest, signal }) => {
      const session = sessionId
        ? services.sessions.getSession(sessionId)
        : undefined;
      logger.debug("CallToolRequest params", {
        request: request.params,
        sessionId,
      });
      const keepaliveStopper = setupDownstreamKeepalive({
        request,
        supportsKeepalive: supportsDownstreamKeepalive(services, sessionId),
        supportsPing: supportsDownstreamPing(services, sessionId),
        sendNotification,
        sendRequest,
        signal,
        logger,
      });
      const consumerTag = session?.metadata.consumerTag;

      try {
        const cached = getCachedToolCallEntry({
          session,
          request,
        });
        switch (cached?.status) {
          case "resolved":
            return cached.result;
          case "rejected":
            throw cached.error;
          case "pending":
            return await cached.promise;
          case undefined:
            logger.debug("No cached tool call entry found", {
              sessionId,
              request,
            });
            break;
        }

        return await createAndAwaitToolCallEntry({
          services,
          session,
          sessionId,
          request,
          consumerTag,
          logger,
        });
      } finally {
        keepaliveStopper();
      }
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

function supportsDownstreamPing(
  services: Services,
  sessionId: string | undefined,
): boolean {
  if (!sessionId) {
    return true;
  }
  const session = services.sessions.getSession(sessionId);
  return session?.metadata.clientInfo.adapter?.support?.ping !== false;
}

function supportsDownstreamKeepalive(
  services: Services,
  sessionId: string | undefined,
): boolean {
  if (!sessionId) {
    return false;
  }
  const session = services.sessions.getSession(sessionId);
  const protocolVersion = session?.metadata.clientInfo.protocolVersion;
  return isProtocolVersionAtLeast(
    protocolVersion,
    MIN_PROTOCOL_VERSION_FOR_KEEPALIVE,
  );
}

function getProgressToken(
  request: CallToolRequest,
): string | number | undefined {
  const meta = request.params?._meta ?? undefined;
  const token = meta?.progressToken;
  if (typeof token === "string" || typeof token === "number") {
    return token;
  }
  return undefined;
}

function setupDownstreamKeepalive(options: {
  request: CallToolRequest;
  supportsKeepalive: boolean;
  supportsPing: boolean;
  sendNotification?: SendNotification;
  sendRequest?: SendRequest;
  signal?: AbortSignal;
  logger?: Logger;
}): () => void {
  const {
    request,
    supportsKeepalive,
    supportsPing,
    sendNotification,
    sendRequest,
    signal,
    logger,
  } = options;

  if (!supportsKeepalive || env.DOWNSTREAM_KEEPALIVE_INTERVAL_MS <= 0) {
    return () => {};
  }

  const progressToken = getProgressToken(request);
  const shouldUseProgress = progressToken !== undefined && !!sendNotification;
  const shouldUsePing = !shouldUseProgress && supportsPing && !!sendRequest;
  if (!shouldUseProgress && !shouldUsePing) {
    return () => {};
  }

  let keepaliveInFlight = false;
  let progressCounter = 0;
  let interval: ReturnType<typeof setInterval> | undefined;

  const stop = (): void => {
    if (!interval) {
      return;
    }
    clearInterval(interval);
    interval = undefined;
  };

  const sendKeepalive = async (): Promise<void> => {
    if (keepaliveInFlight) {
      return;
    }
    keepaliveInFlight = true;
    try {
      if (
        shouldUseProgress &&
        progressToken !== undefined &&
        sendNotification
      ) {
        progressCounter += 1;
        await sendNotification({
          method: "notifications/progress",
          params: {
            progressToken,
            progress: progressCounter,
          },
        });
        return;
      }
      const timeout = Math.floor(
        env.DOWNSTREAM_KEEPALIVE_INTERVAL_MS * MAX_KEEPALIVE_TIMEOUT_RATIO,
      );
      await sendRequest?.({ method: "ping" }, EmptyResultSchema, {
        timeout,
      }).catch(() => {});
    } catch (error) {
      logger?.debug("Downstream keepalive failed", {
        error: loggableError(error),
      });
    } finally {
      keepaliveInFlight = false;
    }
  };

  interval = setInterval(() => {
    void sendKeepalive();
  }, env.DOWNSTREAM_KEEPALIVE_INTERVAL_MS);

  if (signal) {
    signal.addEventListener("abort", stop, { once: true });
  }

  return stop;
}

function executeToolCall(options: {
  services: Services;
  sessionId: string | undefined;
  request: CallToolRequest;
  consumerTag: string | undefined;
  logger: Logger;
}): Promise<ToolCallResultUnion> {
  const { services, sessionId, request, consumerTag, logger } = options;
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

  return measureNonFailable(async () => {
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
  }).then((measureToolCallResult) => {
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
  });
}

function getCachedToolCallEntry(options: {
  session: McpxSession | undefined;
  request: CallToolRequest;
}): ToolCallCacheEntry | undefined {
  const { session, request } = options;
  if (!session || !hasExplicitCorrelationKey(request)) {
    return undefined;
  }

  const cache = getSessionCache(session);
  pruneExpiredCacheEntries(cache);

  const cacheKey = buildToolCallCacheKey(request);
  return cache.get(cacheKey);
}

async function createAndAwaitToolCallEntry(options: {
  services: Services;
  session: McpxSession | undefined;
  sessionId: string | undefined;
  request: CallToolRequest;
  consumerTag: string | undefined;
  logger: Logger;
}): Promise<ToolCallResultUnion> {
  const { services, session, sessionId, request, consumerTag, logger } =
    options;
  if (!sessionId) {
    return executeToolCall({
      services,
      sessionId,
      request,
      consumerTag,
      logger,
    });
  }

  if (!session) {
    return executeToolCall({
      services,
      sessionId,
      request,
      consumerTag,
      logger,
    });
  }
  if (!hasExplicitCorrelationKey(request)) {
    return executeToolCall({
      services,
      sessionId,
      request,
      consumerTag,
      logger,
    });
  }

  const cache = getSessionCache(session);
  pruneExpiredCacheEntries(cache);

  const cacheKey = buildToolCallCacheKey(request);
  const existing = cache.get(cacheKey);
  if (existing) {
    if (existing.status === "resolved") {
      return existing.result;
    }
    if (existing.status === "rejected") {
      throw existing.error;
    }
    return existing.promise;
  }

  const expiresAt = Date.now() + env.TOOL_CALL_CACHE_TTL_MS;
  const promise = executeToolCall({
    services,
    sessionId,
    request,
    consumerTag,
    logger,
  })
    .then((result) => {
      cache.set(cacheKey, {
        status: "resolved",
        result,
        expiresAt: Date.now() + env.TOOL_CALL_CACHE_TTL_MS,
      });
      enforceCacheLimit(cache, env.TOOL_CALL_CACHE_MAX_ENTRIES, logger);
      return result;
    })
    .catch((error) => {
      const normalizedError = makeError(error);
      cache.set(cacheKey, {
        status: "rejected",
        error: normalizedError,
        expiresAt: Date.now() + env.TOOL_CALL_CACHE_TTL_MS,
      });
      enforceCacheLimit(cache, env.TOOL_CALL_CACHE_MAX_ENTRIES, logger);
      logger.debug("Tool call failed", { cacheKey, error: normalizedError });
      throw normalizedError;
    });

  cache.set(cacheKey, {
    status: "pending",
    promise,
    expiresAt,
  });
  enforceCacheLimit(cache, env.TOOL_CALL_CACHE_MAX_ENTRIES, logger);

  return promise;
}

function getSessionCache(session: {
  toolCallCache?: Map<string, ToolCallCacheEntry>;
}): Map<string, ToolCallCacheEntry> {
  if (!session.toolCallCache) {
    session.toolCallCache = new Map();
  }
  return session.toolCallCache;
}

export function pruneExpiredCacheEntries(
  cache: Map<string, ToolCallCacheEntry>,
): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

export function enforceCacheLimit(
  cache: Map<string, ToolCallCacheEntry>,
  maxEntries: number,
  logger?: Logger,
): void {
  if (maxEntries <= 0 || cache.size <= maxEntries) {
    return;
  }

  const evict = (predicate: (entry: ToolCallCacheEntry) => boolean): void => {
    for (const [key, entry] of cache.entries()) {
      if (!predicate(entry)) {
        continue;
      }
      cache.delete(key);
      if (cache.size <= maxEntries) {
        return;
      }
    }
  };

  evict((entry) => entry.status !== "pending");
  if (cache.size > maxEntries) {
    evict(() => true);
  }

  if (cache.size > maxEntries) {
    logger?.debug("Tool call cache still above limit after eviction", {
      size: cache.size,
      maxEntries,
    });
  }
}

function buildToolCallCacheKey(request: CallToolRequest): string {
  const explicitKey = extractCallCorrelationKey(request);
  return `progressToken:${typeof explicitKey}:${String(explicitKey)}`;
}

function extractCallCorrelationKey(
  request: CallToolRequest,
): string | number | undefined {
  return getProgressToken(request);
}

function hasExplicitCorrelationKey(request: CallToolRequest): boolean {
  return extractCallCorrelationKey(request) !== undefined;
}

function isProtocolVersionAtLeast(
  version: string | undefined,
  minimumVersion: string,
): boolean {
  if (!version) {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) {
    return false;
  }
  return version >= minimumVersion;
}
