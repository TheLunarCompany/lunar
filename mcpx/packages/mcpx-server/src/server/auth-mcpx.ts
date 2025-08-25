import { Request, Response, Router } from "express";
import { Logger } from "winston";
import { HubService } from "../services/hub.js";
import { loggableError } from "@mcpx/toolkit-core/logging";

export function buildAuthMcpxRouter(
  hubService: HubService,
  logger: Logger,
): Router {
  const router = Router();

  router.get("/auth/mcpx", (_req: Request, res: Response) => {
    logger.debug("Getting auth status");
    const status = hubService.status;
    res.status(200).json(status);
  });

  router.post("/auth/mcpx", async (req: Request, res: Response) => {
    if (!req.body || !req.body) {
      logger.warn("No body provided in auth request");
      res.status(400).json({ error: "Body is required" });
      return;
    }
    const { token } = req.body;

    if (!token) {
      logger.warn("No token provided in auth request");
      res.status(400).json({ error: "Token is required" });
      return;
    }

    try {
      logger.info("Connecting to Hub with provided token");
      const hubAuthStatus = await hubService.connect(token);

      res.json(hubAuthStatus);
    } catch (e) {
      const error = loggableError(e);
      logger.error("Authentication failed", { error });
      res.status(401).json({
        error: "Authentication failed",
        message: error,
      });
    }
  });

  router.delete("/auth/mcpx", async (_req: Request, res: Response) => {
    try {
      logger.info("Disconnecting from Hub");
      await hubService.disconnect();
      res.status(204).send();
    } catch (e) {
      const error = loggableError(e);
      logger.error("Disconnection failed", { error });
      res.status(500).json({ error: "Disconnection failed", message: error });
    }
  });

  return router;
}
