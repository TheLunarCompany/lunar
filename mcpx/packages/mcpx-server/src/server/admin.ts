import {
  StrictnessResponse,
  strictnessResponseSchema,
  setStrictnessRequestSchema,
} from "@mcpx/shared-model";
import { loggableError } from "@mcpx/toolkit-core/logging";
import express, { Router } from "express";
import { Logger } from "winston";
import z from "zod/v4";
import { Services } from "../services/services.js";

export function buildAdminRouter(
  authGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): Router {
  const router = Router();

  // Middleware to check if caller is admin (based on identity from Hub)
  const adminOnly: express.RequestHandler = (_req, res, next) => {
    if (!services.identityService.isAdmin()) {
      res.status(401).json({ error: "Admin access required" });
      return;
    }
    next();
  };

  // Get current strictness state
  router.get("/strictness", authGuard, adminOnly, (_req, res) => {
    const response: StrictnessResponse = {
      isStrict: services.catalogManager.isStrict(),
      adminOverride: services.catalogManager.getAdminStrictnessOverride(),
    };
    res.json(response satisfies z.infer<typeof strictnessResponseSchema>);
  });

  // Set admin strictness override
  router.post("/strictness", authGuard, adminOnly, (req, res) => {
    const parsed = setStrictnessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: z.treeifyError(parsed.error),
      });
      return;
    }

    services.catalogManager.setAdminStrictnessOverride(parsed.data.override);
    logger.info("Admin strictness override updated via API", {
      override: parsed.data.override,
    });

    const response: StrictnessResponse = {
      isStrict: services.catalogManager.isStrict(),
      adminOverride: services.catalogManager.getAdminStrictnessOverride(),
    };
    res.json(response satisfies z.infer<typeof strictnessResponseSchema>);
  });

  // TODO: extract `Sessions` service and use reload here & in webserver
  router.post("/reload", authGuard, async (_req, res) => {
    try {
      logger.info("Reloading target servers");
      await services.targetClients.initialize();
      logger.debug(
        "Current clientsByService (global)",
        Object.fromEntries(services.targetClients.clientsByService.entries()),
      );
      // Close all existing sessions so they can reconnect and get the updated tools
      await services.sessions.shutdown();
      logger.info("All sessions closed");
      res
        .status(200)
        .send(
          "Target server configuration reloaded (clients will be lazy-loaded per session)",
        );
    } catch (e) {
      const error = loggableError(e);
      logger.error("Error reloading target servers", error);
      res.status(500).send("Error connecting to target servers");
    }
  });

  return router;
}
