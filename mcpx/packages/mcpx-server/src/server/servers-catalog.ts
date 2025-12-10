import {
  catalogMCPServerListSchema,
  CatalogMCPServerList,
} from "@mcpx/shared-model";
import express, { Router } from "express";
import { Services } from "../services/services.js";
import { Logger } from "winston";
import { backendDefaultServers } from "./constants-servers.js";
import z from "zod/v4";

export function buildCatalogRouter(
  authGuard: express.RequestHandler,
  _services: Services,
  _logger: Logger,
): Router {
  const router = Router();

  router.get(
    "/mcp-servers",
    authGuard,
    async (_req: express.Request, res: express.Response) => {
      const parsedServers = catalogMCPServerListSchema.safeParse(
        backendDefaultServers,
      );
      if (!parsedServers.success) {
        return res.status(500).json({
          message:
            "Couldn't verify inner default servers to be in the right format",
          error: z.treeifyError(parsedServers.error),
        });
      }
      return res
        .status(200)
        .json(parsedServers.data satisfies CatalogMCPServerList);
    },
  );

  return router;
}
