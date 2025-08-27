import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Router } from "express";
import { Logger } from "winston";
import { env } from "../env.js";
import { Services } from "../services/services.js";
import {
  getServer,
  respondNoValidSessionId,
  respondTransportMismatch,
  setupPingMonitoring,
  scheduleProbeTransportTermination,
} from "./shared.js";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { extractMetadata, logMetadataWarnings } from "./metadata.js";

export function buildSSERouter(
  authGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): Router {
  const router = Router();

  router.get("/sse", authGuard, async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    const metadata = extractMetadata(req.headers, req.body);
    logMetadataWarnings(metadata, sessionId, logger);

    services.sessions.addSession(sessionId, {
      transport: { type: "sse", transport: transport },
      metadata,
      consumerConfig: undefined,
    });
    logger.debug("SSE connection established", {
      sessionId,
      sessionCount: Object.keys(services.sessions).length,
    });

    const server = await getServer(services, logger, metadata.isProbe);
    await server.connect(transport);

    const stopPing = setupPingMonitoring(
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
      logger.info(
        "Initialized empty server for probe client transport, will be terminated shortly",
        { sessionId, metadata, ...opt },
      );
    }

    transport.onerror = (error: Error): void => {
      logger.error("Session transport error", { sessionId, error, metadata });
      transport.close().catch(() => {
        // Ignore errors on close
      });
      stopPing();
    };

    res.on("close", async () => {
      await server.close();
      await transport.close();
      stopPing();
      services.sessions.removeSession(sessionId);
      logger.debug("SSE connection closed", { sessionId });
    });

    res.on("error", async (e) => {
      const error = loggableError(e);
      logger.error("SSE connection error, terminating", { sessionId, error });
      await server.close();
      await transport.close();
      stopPing();
      services.sessions.removeSession(sessionId);
    });
  });

  router.post("/messages", async (req, res) => {
    const sessionId = req.query["sessionId"] as string;
    const session = services.sessions.getSession(sessionId);

    if (session) {
      switch (session.transport.type) {
        case "sse":
          await session.transport.transport.handlePostMessage(
            req,
            res,
            req.body,
          );
          break;
        case "streamableHttp":
          respondTransportMismatch(res);
          break;
      }
    } else {
      logger.warn("No session found for POST /messages", { sessionId });
      respondNoValidSessionId(res);
    }
  });

  return router;
}
