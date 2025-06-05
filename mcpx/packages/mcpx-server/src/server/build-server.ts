import express from "express";
import { env } from "../env.js";
import { accessLogFor, mcpxLogger } from "../logger.js";
import { Config } from "../model.js";
import { buildAdminRouter } from "./admin.js";
import { buildApiKeyGuard } from "./auth.js";
import { buildSSERouter } from "./sse.js";
import { buildStreamableHttpRouter } from "./streamable.js";
import { Services } from "../services/services.js";
import { createServer, Server } from "http";

export async function buildMcpxServer(
  cfg: Config,
  services: Services,
): Promise<Server> {
  const app = express();
  const server = createServer(app);

  app.use(accessLogFor(mcpxLogger));
  app.use(express.json());

  const apiKeyGuard = buildApiKeyGuard(cfg, env.API_KEY);

  app.use(buildStreamableHttpRouter(apiKeyGuard, services));
  app.use(buildSSERouter(apiKeyGuard, services));
  app.use(buildAdminRouter(apiKeyGuard, services));

  return server;
}
