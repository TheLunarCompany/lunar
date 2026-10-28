import { CatalogMCPServerList, SecretKeys } from "@mcpx/shared-model";
import express, { Router } from "express";
import { Services } from "../services/services.js";
import { BehaviorSetting } from "../services/behavior-service.js";
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
      /* this initialiation has to be inside to get the current value otherwise it will get stale values */
      const isStdioEnabled = services.behaviorService.get(
        BehaviorSetting.ENABLE_STDIO_MCP_SERVERS,
      );
      const servers = services.catalogManager.getCatalog();
      const allowedServers = isStdioEnabled
        ? servers
        : servers.filter((server) => server.config.type !== "stdio");

      return res
        .status(200)
        .json(allowedServers satisfies CatalogMCPServerList);
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
