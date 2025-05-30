import { Router } from "express";
import { logger } from "../logger.js";
import { Services } from "../services/services.js";
import express from "express";
import { loggableError } from "../utils.js";

export function buildAdminRouter(
  apiKeyGuard: express.RequestHandler,
  services: Services,
): Router {
  const router = Router();

  router.post("/reload", apiKeyGuard, async (_req, res) => {
    try {
      logger.info("Reloading target servers");
      await services.targetClients.initialize();
      logger.debug(
        "Current clientsByService",
        Object.fromEntries(services.targetClients.clientsByService.entries()),
      );
      for (const sessionId in services.sessions) {
        const session = services.sessions[sessionId];
        if (session) {
          logger.info("Closing session transport", { sessionId });
          await session.transport.transport.close().catch((e) => {
            const error = loggableError(e);
            logger.error("Error closing session transport", error);
          });
          delete services.sessions[sessionId];
        }
      }
      logger.info("All sessions closed");
      res.status(200).send("Connected to all available target servers");
    } catch (e) {
      const error = loggableError(e);
      logger.error("Error connecting to target servers", error);
      res.status(500).send("Error connecting to target servers");
    }
  });

  return router;
}
