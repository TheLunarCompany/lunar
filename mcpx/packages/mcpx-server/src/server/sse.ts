import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { Router } from "express";
import { Logger } from "winston";
import { Services } from "../services/services.js";
import { CloseSessionReason, TouchSource } from "../services/sessions.js";
import {
  getServer,
  respondNoValidSessionId,
  respondTransportMismatch,
} from "./shared.js";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { extractMetadata, logMetadataWarnings } from "./metadata.js";
import type { McpxSession } from "../model/sessions.js";

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

    const server = await getServer(services, logger, metadata.isProbe);
    await server.connect(transport);

    services.sessions.addSession(sessionId, {
      transport: { type: "sse", transport: transport },
      metadata,
      server,
      consumerConfig: undefined,
    });
    logger.debug("SSE connection established", {
      sessionId,
      sessionCount: Object.keys(services.sessions).length,
    });

    transport.onerror = (error: Error): void => {
      logger.error("Session transport error", { sessionId, error, metadata });
      services.sessions
        .closeSession(sessionId, CloseSessionReason.TransportError)
        .catch(() => {});
    };

    res.on("close", async () => {
      await services.sessions.closeSession(
        sessionId,
        CloseSessionReason.SseClosed,
      );
      logger.debug("SSE connection closed", { sessionId });
    });

    res.on("error", async (e) => {
      const error = loggableError(e);
      logger.error("SSE connection error, terminating", { sessionId, error });
      await services.sessions.closeSession(
        sessionId,
        CloseSessionReason.SseError,
      );
    });
  });

  router.post("/messages", async (req, res) => {
    const sessionId = req.query["sessionId"];
    if (typeof sessionId !== "string") {
      respondNoValidSessionId(res);
      return;
    }

    const session = services.sessions.getSession(sessionId);
    if (!session) {
      logger.warn("No session found for POST /messages", { sessionId });
      respondNoValidSessionId(res);
      return;
    }

    switch (session.transport.type) {
      case "sse": {
        services.sessions.touchSession(sessionId, TouchSource.SsePostMessages);
        const initializePayload = getInitializePayload(req.body);
        if (initializePayload) {
          const metadata = extractMetadata(req.headers, initializePayload);
          logMetadataWarnings(metadata, sessionId, logger);
          session.metadata = mergeSessionMetadata(session.metadata, metadata);
        }
        await session.transport.transport.handlePostMessage(req, res, req.body);
        break;
      }
      case "streamableHttp": {
        respondTransportMismatch(res);
        break;
      }
    }
  });
  return router;
}

function mergeSessionMetadata(
  current: McpxSession["metadata"],
  incoming: McpxSession["metadata"],
): McpxSession["metadata"] {
  return {
    ...current,
    consumerTag: incoming.consumerTag ?? current.consumerTag,
    llm: incoming.llm ?? current.llm,
    clientInfo: {
      ...current.clientInfo,
      ...incoming.clientInfo,
    },
    isProbe: current.isProbe || incoming.isProbe,
  };
}

function getInitializePayload(body: unknown): unknown | undefined {
  if (isInitializeRequest(body)) {
    return body;
  }
  if (Array.isArray(body)) {
    return body.find((item) => isInitializeRequest(item));
  }
  return undefined;
}
