import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express, { Router } from "express";
import { Logger } from "winston";
import { McpxSession } from "../model/sessions.js";
import { Services } from "../services/services.js";
import {
  getServer,
  respondNoValidSessionId,
  respondTransportMismatch,
} from "./shared.js";
import { extractMetadata, logMetadataWarnings } from "./metadata.js";
import { CloseSessionReason, TouchSource } from "../services/sessions.js";

export function buildStreamableHttpRouter(
  authGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): Router {
  const router = Router();
  router.post("/mcp", authGuard, async (req, res) => {
    const sessionId = getSessionIdFromHeaders(req.headers);
    const metadata = extractMetadata(req.headers, req.body);
    logMetadataWarnings(metadata, sessionId, logger);

    let transport: StreamableHTTPServerTransport;

    // Debug logging
    logger.silly("StreamableHTTP request", {
      hasSessionId: !!sessionId,
      sessionId,
      body: req.body,
      isInitRequest: isInitializeRequest(req.body),
    });

    // Initial session creation
    if (!sessionId) {
      logger.info("Initializing new session transport");
      transport = await initializeSession(services, logger, metadata);
    } else if (sessionId) {
      const session = services.sessions.getSession(sessionId);
      if (!session) {
        logger.warn("Session not found", { sessionId, metadata });
        respondNoValidSessionId(res);
        return;
      }
      logger.silly("Reusing existing session transport", { sessionId });
      // Todo must be a better way to handle this duplication
      switch (session.transport.type) {
        case "streamableHttp":
          services.sessions.touchSession(
            sessionId,
            TouchSource.StreamablePostMcp,
          );
          transport = session.transport.transport;
          break;
        case "sse":
          respondTransportMismatch(res);
          return;
      }
    } else {
      logger.warn("No valid session ID provided", { sessionId, metadata });
      respondNoValidSessionId(res);
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // Handle GET requests for server-to-client notifications via SSE
  router.get("/mcp", authGuard, async (req, res) => {
    const sessionId = getSessionIdFromHeaders(req.headers);
    if (!sessionId) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    const session = services.sessions.getSession(sessionId);
    if (!session) {
      res.status(404).send("Session not found");
      return;
    }

    switch (session.transport.type) {
      case "streamableHttp":
        services.sessions.touchSession(sessionId, TouchSource.StreamableGetMcp);
        await session.transport.transport.handleRequest(req, res);
        break;
      case "sse":
        respondTransportMismatch(res);
        break;
    }
  });

  // Handle DELETE requests for session termination
  router.delete("/mcp", authGuard, async (req, res) => {
    const sessionId = getSessionIdFromHeaders(req.headers);
    if (!sessionId) {
      res.status(400).send({ msg: "Invalid or missing session ID" });
      return;
    }
    const session = services.sessions.getSession(sessionId);
    if (!session) {
      res.status(404).send({ msg: "Session not found" });
      return;
    }
    logger.debug("Closing session transport", { sessionId });
    await services.sessions.closeSession(
      sessionId,
      CloseSessionReason.StreamableDelete,
    );
    res.status(200).send();
    return;
  });

  return router;
}

function getSessionIdFromHeaders(
  headers: express.Request["headers"],
): string | undefined {
  const rawSessionId = headers["mcp-session-id"];
  return Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
}

async function initializeSession(
  services: Services,
  logger: Logger,
  metadata: McpxSession["metadata"],
): Promise<StreamableHTTPServerTransport> {
  const sessionId = randomUUID();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: (): string => sessionId,
    onsessioninitialized: (sessionId): void => {
      // Store the transport by session ID
      services.sessions.addSession(sessionId, {
        transport: { type: "streamableHttp", transport },
        consumerConfig: undefined,
        metadata,
        server,
      });
    },
  });

  const server = await getServer(services, logger, metadata.isProbe);
  await server.connect(transport);

  transport.onclose = (): void => {
    if (transport.sessionId) {
      services.sessions
        .closeSession(transport.sessionId, CloseSessionReason.StreamableClosed)
        .catch(() => {});
      logger.debug("Session transport closed", {
        sessionId: transport.sessionId,
        metadata,
      });
    }
  };

  transport.onerror = (error: Error): void => {
    logger.error("Session transport error", { sessionId, error, metadata });
    services.sessions
      .closeSession(sessionId, CloseSessionReason.StreamableError)
      .catch(() => {});
  };

  logger.debug("New session transport created", { sessionId, metadata });

  return transport;
}
