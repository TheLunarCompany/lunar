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
import { env } from "../env.js";
import { extractMetadata, logMetadataWarnings } from "./metadata.js";
import {
  scheduleProbeTransportTermination,
  setupPingMonitoring,
} from "./liveness.js";

export function buildStreamableHttpRouter(
  authGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): Router {
  const router = Router();
  router.post("/mcp", authGuard, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
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
    if (!sessionId && isInitializeRequest(req.body)) {
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
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
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
        await session.transport.transport.handleRequest(req, res);
        break;
      case "sse":
        respondTransportMismatch(res);
        break;
    }
  });

  // Handle DELETE requests for session termination
  router.delete("/mcp", authGuard, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
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
    await session.transport.transport.close();
    services.sessions.removeSession(sessionId);
    res.status(200).send();
    return;
  });

  return router;
}

async function initializeSession(
  services: Services,
  logger: Logger,
  metadata: McpxSession["metadata"],
): Promise<StreamableHTTPServerTransport> {
  const sessionId = randomUUID();
  let stopPing: () => void = () => {};
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: (): string => sessionId,
    onsessioninitialized: (sessionId): void => {
      // Store the transport by session ID
      services.sessions.addSession(sessionId, {
        transport: { type: "streamableHttp", transport },
        consumerConfig: undefined,
        metadata,
      });
      stopPing = setupPingMonitoring(
        server,
        transport,
        sessionId,
        metadata,
        {
          pingIntervalMs: env.PING_INTERVAL_MS,
          maxMissedPings: env.MAX_MISSED_PINGS,
        },
        logger,
      );

      if (metadata.isProbe) {
        const opt = {
          probeClientsGraceLivenessPeriodMs:
            env.PROBE_CLIENTS_GRACE_LIVENESS_PERIOD_MS,
        };
        scheduleProbeTransportTermination(
          services,
          server,
          transport,
          opt,
          stopPing,
        );
        logger.debug(
          "Initialized empty server for probe client transport, will be terminated shortly",
          { sessionId, metadata, ...opt },
        );
      }
    },
  });

  const server = await getServer(services, logger, metadata.isProbe);
  await server.connect(transport);

  transport.onclose = (): void => {
    if (transport.sessionId) {
      services.sessions.removeSession(transport.sessionId);
      logger.debug("Session transport closed", {
        sessionId: transport.sessionId,
        metadata,
      });
    }
    stopPing();
  };

  transport.onerror = (error: Error): void => {
    logger.error("Session transport error", { sessionId, error, metadata });
    transport.close().catch(() => {
      // Ignore errors on close
    });
    stopPing();
  };

  logger.debug("New session transport created", { sessionId, metadata });

  return transport;
}
