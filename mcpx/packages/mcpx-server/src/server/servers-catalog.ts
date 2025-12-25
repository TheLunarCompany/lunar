import { CatalogMCPServerList } from "@mcpx/shared-model";
import express, { Router } from "express";
import { Services } from "../services/services.js";
import { Logger } from "winston";

export function buildCatalogRouter(
  authGuard: express.RequestHandler,
  services: Services,
  _logger: Logger,
): Router {
  const router = Router();

  router.get(
    "/mcp-servers",
    authGuard,
    async (_req: express.Request, res: express.Response) => {
      const servers = services.catalogManager.getCatalog();
      return res.status(200).json(servers satisfies CatalogMCPServerList);
    },
  );

  return router;
}
