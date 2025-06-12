import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express, { Router } from "express";
import { logger } from "../logger.js";
import { Services } from "../services/services.js";
import {
  extractMetadata,
  getServer,
  respondNoValidSessionId,
  respondTransportMismatch,
} from "./shared.js";
import { McpxSession } from "../model.js";

export function buildStreamableHttpRouter(
  apiKeyGuard: express.RequestHandler,
  services: Services,
): Router {
  const router = Router();
  router.post("/mcp", apiKeyGuard, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const metadata = extractMetadata(req.headers);

    let transport: StreamableHTTPServerTransport;
    // Initial session creation
    if (!sessionId && isInitializeRequest(req.body)) {
      transport = await initializeSession(services, metadata);
    } else if (sessionId) {
      const session = services.sessions.getSession(sessionId);
      if (!session) {
        logger.warn("Session not found", { sessionId });
        respondNoValidSessionId(res);
        return;
      }
      logger.info("Reusing existing session transport", { sessionId });
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
      logger.warn("No valid session ID provided", { sessionId });
      respondNoValidSessionId(res);
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // Handle GET requests for server-to-client notifications via SSE
  router.get("/mcp", apiKeyGuard, async (req, res) => {
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
  router.delete("/mcp", apiKeyGuard, async (req, res) => {
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
    logger.info("Closing session transport", { sessionId });
    services.sessions.removeSession(sessionId);
    res.status(405).send();
    return;
  });

  return router;
}

async function initializeSession(
  services: Services,
  metadata: McpxSession["metadata"],
): Promise<StreamableHTTPServerTransport> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: (): string => randomUUID(),
    onsessioninitialized: (sessionId): void => {
      // Store the transport by session ID
      services.sessions.addSession(sessionId, {
        transport: { type: "streamableHttp", transport: transport },
        consumerConfig: undefined,
        metadata,
      });
    },
  });

  transport.onclose = (): void => {
    logger.info("hi");
    if (transport.sessionId) {
      services.sessions.removeSession(transport.sessionId);
      logger.debug("Session transport closed", {
        sessionId: transport.sessionId,
        metadata,
      });
    }
  };

  const server = getServer(services);
  await server.connect(transport);

  logger.info("New session transport created", {
    sessionId: transport.sessionId,
    metadata,
  });

  return transport;
}
