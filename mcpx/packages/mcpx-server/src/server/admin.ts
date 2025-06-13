import { Router } from "express";
import { Services } from "../services/services.js";
import express from "express";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

export function buildAdminRouter(
  apiKeyGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): Router {
  const router = Router();

  // TODO: extract `Sessions` service and use reload here & in webserver
  router.post("/reload", apiKeyGuard, async (_req, res) => {
    try {
      logger.info("Reloading target servers");
      await services.targetClients.initialize();
      logger.debug(
        "Current clientsByService",
        Object.fromEntries(services.targetClients.clientsByService.entries()),
      );
      // Close all existing sessions so they can reconnect and get the updated tools
      await services.sessions.shutdown();
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
