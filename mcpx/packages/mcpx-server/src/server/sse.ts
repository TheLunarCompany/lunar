import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Router } from "express";
import { mcpxLogger } from "../logger.js";
import { Services } from "../services/services.js";
import {
  extractMetadata,
  getServer,
  respondNoValidSessionId,
  respondTransportMismatch,
} from "./shared.js";

export function buildSSERouter(
  apiKeyGuard: express.RequestHandler,
  services: Services,
): Router {
  const router = Router();

  router.get("/sse", apiKeyGuard, async (req, res) => {
    const metadata = extractMetadata(req.headers);
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    services.sessions.addSession(sessionId, {
      transport: { type: "sse", transport: transport },
      metadata,
      consumerConfig: undefined,
    });
    mcpxLogger.info("SSE connection established", {
      sessionId,
      sessionCount: Object.keys(services.sessions).length,
    });

    const server = getServer(services);
    await server.connect(transport);

    res.on("close", async () => {
      await server.close();
      await transport.close();
      services.sessions.removeSession(sessionId);
      mcpxLogger.info("SSE connection closed", { sessionId });
    });
  });

  router.post("/messages", async (req, res) => {
    const sessionId = req.query["sessionId"] as string;
    const session = services.sessions.getSession(sessionId);

    if (session) {
      mcpxLogger.info("Received POST /messages, sending message to transport", {
        metadata: session.metadata,
        sessionId,
        method: req.body.method,
      });
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
      mcpxLogger.warn("No session found for POST /messages", { sessionId });
      respondNoValidSessionId(res);
    }
  });

  return router;
}
