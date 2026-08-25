import { CatalogMCPServerList, SecretKeys } from "@mcpx/shared-model";
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

  router.get(
    "/secrets",
    authGuard,
    async (_req: express.Request, res: express.Response) => {
      const secretKeys = services.envVarManager.getProfileSecretKeys();
      return res.status(200).json(secretKeys satisfies SecretKeys);
    },
  );

  return router;
}
