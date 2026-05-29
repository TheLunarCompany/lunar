import { makeError } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { measureNonFailable } from "@mcpx/toolkit-core/time";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  EmptyResultSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";
import { env } from "../env.js";
import { AuditLogEvent } from "../model/audit-log-type.js";
import { stableStringify } from "@mcpx/toolkit-core/data";
import { Services } from "../services/services.js";
import { TokenExpiredError } from "../errors.js";
import {
  McpxSession,
  ToolCallCacheEntry,
  ToolCallResultUnion,
} from "../model/sessions.js";
import { UnavailableReason } from "../services/capability-resolver.js";
import {
  HiddenInternalToolError,
  UnknownInternalToolError,
} from "../services/internal-tools-service.js";
const MIN_PROTOCOL_VERSION_FOR_KEEPALIVE = "2025-11-25";
const MAX_KEEPALIVE_TIMEOUT_RATIO = 0.8;
type RequestHandler = Parameters<Server["setRequestHandler"]>[1];
type Extra = Parameters<RequestHandler>[1];
type SendRequest = Extra["sendRequest"];
type SendNotification = Extra["sendNotification"];

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
  const capabilities = { tools: { listChanged: true } };
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
      const consumer = services.sessions.getConsumerContext(sessionId);

      // Per-handler visibility + enrichment for origin="internal" tools (auth,
      // dynamic-capabilities, etc.) lives in InternalToolsService; upstream
      // tools surface as-is.
      const tools: Tool[] = [];
      for (const cap of services.capabilityResolver.getVisibleTools(consumer)) {
        if (cap.origin === "internal") {
          const visible = services.internalTools.visibleForListing(
            cap,
            consumer,
          );
          if (visible) tools.push(visible);
          continue;
        }
        tools.push(cap.definition);
      }

      if (logger.isSillyEnabled()) {
        logger.debug("ListToolsRequest response", { tools });
      } else {
        logger.debug("ListToolsRequest response", { toolCount: tools.length });
      }
      return { tools };
    },
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, { sessionId, sendNotification, sendRequest, signal }) => {
      const session = sessionId
        ? services.sessions.getSession(sessionId)
        : undefined;
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
      const clientName = session?.metadata.clientInfo?.name;

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
            break;
        }

        return await createAndAwaitToolCallEntry({
          services,
          session,
          sessionId,
          request,
          clientName,
          consumerTag,
          authorization: session?.metadata.authorization,
          logger,
        });
      } finally {
        keepaliveStopper();
      }
    },
  );

  return server;
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

async function executeToolCall(options: {
  services: Services;
  sessionId: string | undefined;
  request: CallToolRequest;
  clientName: string | undefined;
  consumerTag: string | undefined;
  authorization: string | undefined;
}): Promise<ToolCallResultUnion> {
  const {
    services,
    sessionId,
    request,
    consumerTag,
    clientName,
    authorization,
  } = options;

  const resolved = services.capabilityResolver.resolveToolCall(
    request.params.name,
    { consumerTag, clientName },
  );
  if (!resolved.ok) {
    throw makeUnavailableError("Tool", request.params.name, resolved.reason);
  }
  const { entry } = resolved;

  if (entry.origin === "internal") {
    return services.internalTools
      .dispatch(entry, request.params.arguments ?? {}, {
        consumerTag,
        clientName,
      })
      .catch((e: unknown) => {
        if (
          e instanceof HiddenInternalToolError ||
          e instanceof UnknownInternalToolError
        ) {
          throw makeUnavailableError("Tool", request.params.name, "unknown");
        }
        throw e;
      });
  }

  return executeUpstreamToolCall({
    services,
    sessionId,
    request,
    serverName: entry.serverName,
    capabilityName: entry.capabilityName,
    clientName,
    consumerTag,
    authorization,
  });
}

function executeUpstreamToolCall(options: {
  services: Services;
  sessionId: string | undefined;
  request: CallToolRequest;
  serverName: string;
  capabilityName: string;
  clientName: string | undefined;
  consumerTag: string | undefined;
  authorization: string | undefined;
}): Promise<ToolCallResultUnion> {
  const {
    services,
    sessionId,
    request,
    serverName,
    capabilityName,
    clientName,
    consumerTag,
    authorization,
  } = options;

  return measureNonFailable(async () => {
    const { name: _downstreamToolName, ...forwardedParams } = request.params;
    const meta = authorization
      ? { ...forwardedParams._meta, authorization }
      : forwardedParams._meta;
    const result = await services.upstreamHandler
      .callTool(serverName, {
        ...forwardedParams,
        _meta: meta,
        name: capabilityName,
      })
      .catch((e: unknown) => {
        if (e instanceof TokenExpiredError) {
          return {
            content: [{ type: "text" as const, text: e.message }],
            isError: true,
          };
        }
        throw e;
      });

    services.systemStateTracker.recordToolCall({
      targetServerName: serverName,
      toolName: capabilityName,
      sessionId,
    });
    const toolUsedEvent: AuditLogEvent = {
      eventType: "tool_used",
      payload: {
        toolName: capabilityName,
        targetServerName: serverName,
        args: request.params.arguments || undefined,
        consumerTag: consumerTag || undefined,
      },
    };
    services.auditLog.log(toolUsedEvent);

    return result;
  }).then((measureToolCallResult) => {
    const sessionMeta = sessionId
      ? services.sessions.getSession(sessionId)?.metadata
      : undefined;

    const isError =
      !measureToolCallResult.success ||
      // Type inference for `.isError` fails, but it is indeed a boolean
      Boolean(measureToolCallResult.result.isError);

    const agentLabel = consumerTag ?? clientName ?? "unidentified_agent";

    const labels: Record<string, string> = {
      tool_name: capabilityName,
      error: isError.toString(),
      agent: agentLabel,
      llm: sessionMeta?.llm?.provider ?? "unknown",
      model: sessionMeta?.llm?.modelId ?? "unknown",
    };

    services.metricRecorder.recordToolCallDuration(
      measureToolCallResult.duration,
      labels,
    );

    services.hubService.recordToolCall({
      serverName,
      toolName: capabilityName,
      clientName,
      consumerTag,
      durationMs: measureToolCallResult.duration,
      isError,
      isCallFailure: !measureToolCallResult.success,
    });

    if (measureToolCallResult.success) {
      return measureToolCallResult.result;
    }
    return Promise.reject(measureToolCallResult.error);
  });
}

// Single mapping site for wire-level error strings. IT test asserts on
// `/not available/i`.
function makeUnavailableError(
  kind: "Tool",
  name: string,
  reason: UnavailableReason,
): Error {
  switch (reason) {
    case "permission-denied":
      return new Error("Permission denied");
    case "server-inactive":
      return new Error(`${kind} ${name} is not available (server inactive)`);
    case "unknown":
      return new Error(`${kind} ${name} is not available`);
    default: {
      // Exhaustiveness check — new UnavailableReason variants force a compile
      // error here.
      const _exhaustive: never = reason;
      throw new Error(`Unhandled reason: ${String(_exhaustive)}`);
    }
  }
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
  clientName: string | undefined;
  consumerTag: string | undefined;
  authorization: string | undefined;
  logger: Logger;
}): Promise<ToolCallResultUnion> {
  const {
    services,
    session,
    sessionId,
    request,
    clientName,
    consumerTag,
    authorization,
    logger,
  } = options;
  // No session or no correlation key → skip the cache entirely.
  if (!sessionId || !session || !hasExplicitCorrelationKey(request)) {
    return executeToolCall({
      services,
      sessionId,
      request,
      clientName,
      consumerTag,
      authorization,
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
    clientName,
    consumerTag,
    authorization,
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

  // Never evict pending entries: a duplicate request sharing the correlation
  // key would otherwise miss the cache and fire a second upstream call,
  // which is exactly what the cache is supposed to prevent. If the cap is
  // saturated by in-flight calls, we let it briefly exceed maxEntries.
  evict((entry) => entry.status !== "pending");

  if (cache.size > maxEntries) {
    logger?.debug("Tool call cache exceeds limit (in-flight entries)", {
      size: cache.size,
      maxEntries,
    });
  }
}

export function buildToolCallCacheKey(request: CallToolRequest): string {
  const explicitKey = extractCallCorrelationKey(request);
  return [
    `progressToken:${typeof explicitKey}:${String(explicitKey)}`,
    `toolName:${request.params.name}`,
    `arguments:${stableStringify(request.params.arguments)}`,
  ].join("|");
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
