import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express, { Router } from "express";
import { mcpxLogger } from "../logger.js";
import { Services } from "../services/services.js";
import {
  getServer,
  respondNoValidSessionId,
  respondTransportMismatch,
} from "./shared.js";

export function buildStreamableHttpRouter(
  apiKeyGuard: express.RequestHandler,
  services: Services,
): Router {
  const router = Router();
  router.post("/mcp", apiKeyGuard, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const consumerTag = req.headers["x-lunar-consumer-tag"] as
      | string
      | undefined;

    let transport: StreamableHTTPServerTransport;
    // Initial session creation
    if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: (): string => randomUUID(),
        onsessioninitialized: (sessionId): void => {
          // Store the transport by session ID
          services.sessions[sessionId] = {
            transport: { type: "streamableHttp", transport: transport },
            consumerConfig: undefined,
            consumerTag,
          };
        },
      });

      transport.onclose = (): void => {
        if (transport.sessionId) {
          delete services.sessions[transport.sessionId];
        }
      };

      const server = getServer(services);
      await server.connect(transport);

      mcpxLogger.info("New session transport created", {
        sessionId: transport.sessionId,
      });
    } else if (sessionId && services.sessions[sessionId]) {
      mcpxLogger.info("Reusing existing session transport", { sessionId });
      // Todo must be a better way to handle this duplication
      switch (services.sessions[sessionId].transport.type) {
        case "streamableHttp":
          transport = services.sessions[sessionId].transport.transport;
          break;
        case "sse":
          respondTransportMismatch(res);
          return;
      }
    } else {
      mcpxLogger.warn("No valid session ID provided", { sessionId });
      respondNoValidSessionId(res);
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !services.sessions[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    switch (services.sessions[sessionId].transport.type) {
      case "streamableHttp":
        await services.sessions[sessionId].transport.transport.handleRequest(
          req,
          res,
        );
        break;
      case "sse":
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: Transport type mismatch",
          },
        });
        return;
    }
  };

  // Handle GET requests for server-to-client notifications via SSE
  router.get("/mcp", apiKeyGuard, handleSessionRequest);

  // Handle DELETE requests for session termination
  router.delete("/mcp", apiKeyGuard, handleSessionRequest);

  return router;
}
