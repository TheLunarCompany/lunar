import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express, { Router } from "express";
import { Logger } from "winston";
import { McpxSession } from "../model/sessions.js";
import { Services } from "../services/services.js";
import { env } from "../env.js";
import { getServer } from "./mcp-gateway.js";
import { extractMetadata, logMetadataWarnings } from "./metadata.js";
import { CloseSessionReason, TouchSource } from "../services/sessions.js";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { InMemoryEventStore } from "./streamable-event-store.js";

type DownstreamTransportType = McpxSession["transport"]["type"];
type DownstreamTransport = StreamableHTTPServerTransport | SSEServerTransport;
interface StreamableTransportParams {
  metadata: McpxSession["metadata"];
  /** Optional session ID to reuse (e.g. when reinitializing after hibernation). */
  sessionIdHint?: string;
}

interface SseTransportParams {
  metadata: McpxSession["metadata"];
  res: express.Response;
}

interface BindTransportLifecycleParams {
  transport: DownstreamTransport;
  transportType: DownstreamTransportType;
  metadata: McpxSession["metadata"];
  transportSessionId: string;
}

const MIN_PROTOCOL_VERSION_FOR_STREAMABLE_EVENTS = "2025-11-25";

export function buildDownstreamTransportsRouter(
  authGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): Router {
  const router = Router();
  registerTransportRoutes(router, "/mcp", authGuard, services, logger);
  registerTransportRoutes(router, "/sse", authGuard, services, logger);
  registerLegacySseMessagesRoute(router, authGuard, services, logger);

  return router;
}

function registerLegacySseMessagesRoute(
  router: Router,
  authGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): void {
  const routeLogger = logger.child({
    route: "/messages",
    transportType: "sse",
  });

  // Backward compatibility for legacy SSE clients posting to /messages?sessionId=...
  router.post("/messages", authGuard, async (req, res) => {
    const sessionId = getSessionIdFromQuery(req.query);
    const metadata = extractMetadata(req.headers, req.body);
    logMetadataWarnings(metadata, sessionId, routeLogger);

    if (!sessionId) {
      respondMissingSessionId(res);
      return;
    }

    const session = services.sessions.getSession(sessionId);
    if (!session) {
      routeLogger.warn("No session found for legacy SSE message route", {
        sessionId,
      });
      respondSessionNotFound(res);
      return;
    }
    if (session.transport.type !== "sse") {
      routeLogger.warn("Transport type mismatch on legacy SSE message route", {
        sessionId,
        expected: "sse",
        actual: session.transport.type,
      });
      respondTransportMismatch(res);
      return;
    }

    if (
      metadata.authorization !== session.metadata.authorization ||
      hasClientInfo(metadata.clientInfo)
    ) {
      services.sessions.updateSessionMetadata(
        sessionId,
        mergeMetadata(session.metadata, metadata),
      );
    }
    services.sessions.touchSession(sessionId, TouchSource.TransportPostMcp);
    await session.transport.transport.handlePostMessage(req, res, req.body);
  });
}

function registerTransportRoutes(
  router: Router,
  basePath: string,
  authGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): void {
  const baseLogger = logger.child({ route: basePath });
  const transportFactory = new DownstreamTransportFactory(
    services,
    baseLogger,
    basePath,
  );
  const transportType = transportFactory.transportType;
  const routeLogger = baseLogger.child({ transportType });

  async function tryRestoreStreamableSession(
    sessionId: string,
    req: express.Request,
    res: express.Response,
    incomingMetadata?: McpxSession["metadata"],
    body?: unknown,
  ): Promise<boolean> {
    const persisted = await services.sessions
      .loadPersistedDownstreamSession(sessionId)
      .catch((error) => {
        routeLogger.warn("Failed to load persisted session from Hub", {
          sessionId,
          error: loggableError(error),
        });
        return undefined;
      });
    if (!persisted) {
      return false;
    }
    const resolvedMetadata = incomingMetadata
      ? mergeMetadata(persisted.metadata, incomingMetadata)
      : persisted.metadata;
    routeLogger.info("Transparently restoring session", {
      sessionId,
      restoredFromHub: true,
      metadata: resolvedMetadata,
    });
    return transportFactory
      .getStreamableTransportRestored({
        metadata: resolvedMetadata,
        sessionIdHint: sessionId,
      })
      .then((transport) => transport.handleRequest(req, res, body))
      .then(() => true)
      .catch((error) => {
        routeLogger.error("Transparent session restoration failed", {
          sessionId,
          error: loggableError(error),
        });
        return false;
      });
  }

  router.post(basePath, authGuard, async (req, res) => {
    const sessionId = getSessionIdFromRequest(req, transportType);
    const metadata = extractMetadata(req.headers, req.body);
    logMetadataWarnings(metadata, sessionId, routeLogger);

    // Initial session creation
    if (!sessionId) {
      if (transportType === "sse") {
        respondMissingSessionId(res);
        return;
      }
      const transport = await transportFactory.getStreamableTransport({
        metadata,
      });
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Existing session
    const session = services.sessions.getSession(sessionId);
    if (!session) {
      // Recovery path after hibernation/session expiry:
      // Non-initialize requests return 404, prompting the client to reinitialize
      // with the same session ID per the MCP spec. That reinitialize hits this
      // branch and recreates (or restores from Hub) the session seamlessly.
      if (transportType === "streamableHttp" && isInitializeRequest(req.body)) {
        const persisted =
          await services.sessions.loadPersistedDownstreamSession(sessionId);
        const resolvedMetadata = persisted
          ? mergeMetadata(persisted.metadata, metadata)
          : metadata;
        routeLogger.info(
          "Reinitializing expired session on initialize request",
          {
            sessionId,
            restoredFromHub: !!persisted,
            metadata: resolvedMetadata,
          },
        );
        const transport = await transportFactory.getStreamableTransport({
          metadata: resolvedMetadata,
          sessionIdHint: sessionId,
        });
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (transportType === "streamableHttp") {
        if (
          await tryRestoreStreamableSession(
            sessionId,
            req,
            res,
            metadata,
            req.body,
          )
        ) {
          return;
        }
        routeLogger.info(
          "Streamable HTTP session not found, returning 404 to prompt reinitialize",
          { sessionId, metadata },
        );
        respondSessionNotFound(res);
        return;
      }

      routeLogger.warn("Session not found", { sessionId, metadata });
      respondSessionNotFound(res);
      return;
    }
    if (session.transport.type !== transportType) {
      routeLogger.warn("Transport type mismatch", {
        sessionId,
        expected: transportType,
        actual: session.transport.type,
      });
      respondTransportMismatch(res);
      return;
    }
    // clientInfo comes from the body — only SSE re-sends it after initialize.
    // authorization comes from headers — always fresh, any transport.
    const shouldUpdateMetadata =
      metadata.authorization !== session.metadata.authorization ||
      (transportType === "sse" && hasClientInfo(metadata.clientInfo));
    if (shouldUpdateMetadata) {
      services.sessions.updateSessionMetadata(
        sessionId,
        mergeMetadata(session.metadata, metadata),
      );
    }
    services.sessions.touchSession(sessionId, TouchSource.TransportPostMcp);
    if (session.transport.type === "streamableHttp") {
      await session.transport.transport.handleRequest(req, res, req.body);
      return;
    }
    await session.transport.transport.handlePostMessage(req, res, req.body);
  });

  // Handle GET requests for streamable notifications or SSE connects
  router.get(basePath, authGuard, async (req, res) => {
    const sessionId = getSessionIdFromRequest(req, transportType);
    if (transportType === "sse") {
      if (sessionId) {
        res.status(400).send("Session ID must not be provided for SSE connect");
        return;
      }
      const metadata = extractMetadata(req.headers, req.body);
      logMetadataWarnings(metadata, sessionId, routeLogger);
      // SSE GET only establishes the long-lived transport/session; MCP messages are sent later via POST.
      await transportFactory.getSseTransport({
        metadata,
        res,
      });
      return;
    }
    if (!sessionId) {
      respondMissingSessionForStreamableGet(res);
      return;
    }
    const session = services.sessions.getSession(sessionId);

    if (!session) {
      if (
        transportType === "streamableHttp" &&
        (await tryRestoreStreamableSession(sessionId, req, res))
      ) {
        return;
      }
      respondSessionNotFound(res);
      return;
    }
    if (session.transport.type !== transportType) {
      routeLogger.warn("Transport type mismatch", {
        sessionId,
        expected: transportType,
        actual: session.transport.type,
      });
      respondTransportMismatch(res);
      return;
    }

    services.sessions.touchSession(sessionId, TouchSource.TransportGetMcp);
    try {
      session.transport.transport.closeStandaloneSSEStream();
    } catch (error) {
      routeLogger.debug("Failed to close standalone SSE stream", {
        sessionId,
        error,
      });
    }
    await session.transport.transport.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  router.delete(basePath, authGuard, async (req, res) => {
    // Legacy SSE transport does not define session termination via DELETE.
    if (transportType === "sse") {
      res.status(405).send();
      return;
    }
    const sessionId = getSessionIdFromRequest(req, transportType);
    if (!sessionId) {
      respondMissingSessionId(res);
      return;
    }
    const session = services.sessions.getSession(sessionId);
    if (!session) {
      respondSessionNotFound(res);
      return;
    }
    if (session.transport.type !== transportType) {
      routeLogger.warn("Transport type mismatch", {
        sessionId,
        expected: transportType,
        actual: session.transport.type,
      });
      respondTransportMismatch(res);
      return;
    }
    routeLogger.debug("Closing session transport", { sessionId });
    await services.sessions.closeSession(
      sessionId,
      CloseSessionReason.TransportDelete,
    );
    res.status(200).send();
  });
}

function getSessionIdFromHeaders(
  headers: express.Request["headers"],
): string | undefined {
  const rawSessionId = headers["mcp-session-id"];
  return Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
}

function getSessionIdFromQuery(
  query: express.Request["query"],
): string | undefined {
  const rawSessionId = query["sessionId"];
  if (Array.isArray(rawSessionId)) {
    const firstValue = rawSessionId[0];
    return typeof firstValue === "string" ? firstValue : undefined;
  }
  return typeof rawSessionId === "string" ? rawSessionId : undefined;
}

function getSessionIdFromRequest(
  req: express.Request,
  transportType: DownstreamTransportType,
): string | undefined {
  if (transportType === "sse") {
    return (
      getSessionIdFromQuery(req.query) ?? getSessionIdFromHeaders(req.headers)
    );
  }
  return getSessionIdFromHeaders(req.headers);
}

function createMcpErrorMessage(message: string, code: number = -32000): object {
  return {
    jsonrpc: "2.0",
    error: {
      code,
      message,
    },
    id: null,
  };
}

function hasClientInfo(
  clientInfo: McpxSession["metadata"]["clientInfo"],
): boolean {
  return Boolean(
    clientInfo.protocolVersion ||
      clientInfo.name ||
      clientInfo.version ||
      clientInfo.title ||
      clientInfo.websiteUrl ||
      (clientInfo.icons && clientInfo.icons.length > 0) ||
      clientInfo.adapter,
  );
}

function mergeMetadata(
  current: McpxSession["metadata"],
  incoming: McpxSession["metadata"],
): McpxSession["metadata"] {
  const mergedLlm =
    incoming.llm && current.llm
      ? {
          provider: incoming.llm.provider ?? current.llm.provider,
          modelId: incoming.llm.modelId ?? current.llm.modelId,
        }
      : (incoming.llm ?? current.llm);
  const incomingAdapter = incoming.clientInfo.adapter;
  const currentAdapter = current.clientInfo.adapter;
  const mergedPingSupport =
    incomingAdapter?.support?.ping ?? currentAdapter?.support?.ping;
  const mergedAdapter =
    incomingAdapter && currentAdapter
      ? {
          name: incomingAdapter.name,
          version: incomingAdapter.version ?? currentAdapter.version,
          support:
            mergedPingSupport === undefined
              ? undefined
              : { ping: mergedPingSupport },
        }
      : (incomingAdapter ?? currentAdapter);
  return {
    consumerTag: incoming.consumerTag ?? current.consumerTag,
    clientId: current.clientId,
    llm: mergedLlm,
    isProbe: current.isProbe || incoming.isProbe,
    clientInfo: {
      protocolVersion:
        incoming.clientInfo.protocolVersion ??
        current.clientInfo.protocolVersion,
      name: incoming.clientInfo.name ?? current.clientInfo.name,
      version: incoming.clientInfo.version ?? current.clientInfo.version,
      title: incoming.clientInfo.title ?? current.clientInfo.title,
      websiteUrl:
        incoming.clientInfo.websiteUrl ?? current.clientInfo.websiteUrl,
      icons: incoming.clientInfo.icons ?? current.clientInfo.icons,
      adapter: mergedAdapter,
    },
    authorization: incoming.authorization ?? current.authorization,
  };
}

function respondTransportMismatch(res: express.Response): void {
  res
    .status(400)
    .json(createMcpErrorMessage("Bad Request: Transport type mismatch"));
}

function respondMissingSessionId(res: express.Response): void {
  res
    .status(400)
    .json(
      createMcpErrorMessage("Bad Request: Mcp-Session-Id header is required"),
    );
}

function respondSessionNotFound(res: express.Response): void {
  res.status(404).json(createMcpErrorMessage("Session not found", -32001));
}

function respondMissingSessionForStreamableGet(res: express.Response): void {
  // The standalone GET SSE stream is optional for Streamable HTTP clients.
  // Returning 405 here avoids surfacing a hard transport error and lets clients continue via POST.
  res.status(405).send();
}

class DownstreamTransportFactory {
  private services: Services;
  private logger: Logger;
  private endpointPath: string;
  transportType: DownstreamTransportType;

  constructor(services: Services, logger: Logger, endpointPath: string) {
    this.services = services;
    this.endpointPath = endpointPath;
    this.transportType =
      DownstreamTransportFactory.getTransportTypeForPath(endpointPath);
    this.logger = logger.child({ transportType: this.transportType });
  }

  async getStreamableTransport({
    metadata,
    sessionIdHint,
  }: StreamableTransportParams): Promise<StreamableHTTPServerTransport> {
    if (this.transportType !== "streamableHttp") {
      throw new Error(
        `Expected streamable HTTP transport for ${this.endpointPath}`,
      );
    }
    const server = await getServer(
      this.services,
      this.logger,
      metadata.isProbe,
    );
    const streamableSessionId = sessionIdHint ?? randomUUID();
    const eventStore = supportsStreamableEventReplay(metadata)
      ? new InMemoryEventStore(this.logger, {
          maxEventAgeMs: env.STREAMABLE_EVENT_STORE_MAX_EVENT_AGE_MS,
        })
      : undefined;
    const streamableTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: (): string => streamableSessionId,
      onsessioninitialized: (initializedSessionId): void => {
        void this.services.sessions.addSession(initializedSessionId, {
          transport: {
            type: "streamableHttp",
            transport: streamableTransport,
          },
          consumerConfig: undefined,
          metadata,
          server,
        });
      },
      ...(eventStore ? { eventStore } : {}),
    });

    await server.connect(streamableTransport);
    this.bindTransportLifecycle({
      transport: streamableTransport,
      transportType: "streamableHttp",
      metadata,
      transportSessionId: streamableSessionId,
    });
    return streamableTransport;
  }

  async getStreamableTransportRestored({
    metadata,
    sessionIdHint,
  }: Required<StreamableTransportParams>): Promise<StreamableHTTPServerTransport> {
    if (this.transportType !== "streamableHttp") {
      throw new Error(
        `Expected streamable HTTP transport for ${this.endpointPath}`,
      );
    }
    const server = await getServer(
      this.services,
      this.logger,
      metadata.isProbe,
    );
    const eventStore = supportsStreamableEventReplay(metadata)
      ? new InMemoryEventStore(this.logger, {
          maxEventAgeMs: env.STREAMABLE_EVENT_STORE_MAX_EVENT_AGE_MS,
        })
      : undefined;
    // onsessioninitialized is intentionally omitted — we register the session
    // manually below after pre-seeding the initialized state.
    const streamableTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: (): string => sessionIdHint,
      ...(eventStore ? { eventStore } : {}),
    });

    // No public SDK API exists for pre-seeding session state (tracking: sdk#1786).
    // Set the private fields directly to make validateSession() pass for
    // non-initialize requests without requiring a client round-trip.
    type SdkTransportInternals = {
      _webStandardTransport: { _initialized: boolean; sessionId: string };
    };
    const inner = (streamableTransport as unknown as SdkTransportInternals)
      ._webStandardTransport;
    inner._initialized = true;
    inner.sessionId = sessionIdHint;

    await server.connect(streamableTransport);

    await this.services.sessions.addSession(sessionIdHint, {
      transport: {
        type: "streamableHttp",
        transport: streamableTransport,
      },
      consumerConfig: undefined,
      metadata,
      server,
    });

    this.bindTransportLifecycle({
      transport: streamableTransport,
      transportType: "streamableHttp",
      metadata,
      transportSessionId: sessionIdHint,
    });
    return streamableTransport;
  }

  async getSseTransport({
    metadata,
    res,
  }: SseTransportParams): Promise<SSEServerTransport> {
    if (this.transportType !== "sse") {
      throw new Error(`Expected SSE transport for ${this.endpointPath}`);
    }
    const server = await getServer(
      this.services,
      this.logger,
      metadata.isProbe,
    );
    const sseTransport = new SSEServerTransport(this.endpointPath, res);
    await server.connect(sseTransport);
    void this.services.sessions.addSession(sseTransport.sessionId, {
      transport: { type: "sse", transport: sseTransport },
      consumerConfig: undefined,
      metadata,
      server,
    });
    this.bindTransportLifecycle({
      transport: sseTransport,
      transportType: "sse",
      metadata,
      transportSessionId: sseTransport.sessionId,
    });
    return sseTransport;
  }

  private bindTransportLifecycle({
    transport,
    transportType,
    metadata,
    transportSessionId,
  }: BindTransportLifecycleParams): void {
    transport.onclose = (): void => {
      const activeSessionId = transport.sessionId ?? transportSessionId;
      if (activeSessionId) {
        this.services.sessions
          .closeSession(activeSessionId, CloseSessionReason.TransportClosed)
          .catch((e) => {
            this.logger.error("Error closing session", {
              sessionId: activeSessionId,
              error: loggableError(e),
            });
          });
        this.logger.debug("Session transport closed", {
          sessionId: activeSessionId,
          metadata,
        });
      }
    };

    transport.onerror = (error: Error): void => {
      const activeSessionId = transport.sessionId ?? transportSessionId;
      this.logger.error("Session transport error", {
        sessionId: activeSessionId,
        error,
        metadata,
      });
      if (activeSessionId) {
        this.services.sessions
          .closeSession(activeSessionId, CloseSessionReason.TransportError)
          .catch(() => {});
      }
    };

    this.logger.debug("New session transport created", {
      sessionId: transport.sessionId ?? transportSessionId,
      transportType,
      metadata,
    });
  }

  private static getTransportTypeForPath(
    endpointPath: string,
  ): DownstreamTransportType {
    if (endpointPath === "/sse") {
      return "sse";
    }
    return "streamableHttp";
  }
}

function supportsStreamableEventReplay(
  metadata: McpxSession["metadata"],
): boolean {
  return isProtocolVersionAtLeast(
    metadata.clientInfo.protocolVersion,
    MIN_PROTOCOL_VERSION_FOR_STREAMABLE_EVENTS,
  );
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
