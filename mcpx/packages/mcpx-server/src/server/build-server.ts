import express from "express";
import { createServer, Server } from "http";
import { ConfigManager } from "../config.js";
import { env } from "../env.js";
import { accessLogFor, mcpxLogger } from "../logger.js";
import { Services } from "../services/services.js";
import { buildAdminRouter } from "./admin.js";
import { buildApiKeyGuard } from "./auth.js";
import { buildSSERouter } from "./sse.js";
import { buildStreamableHttpRouter } from "./streamable.js";

export async function buildMcpxServer(
  config: ConfigManager,
  services: Services,
): Promise<Server> {
  const app = express();
  const server = createServer(app);

  app.use(accessLogFor(mcpxLogger));
  app.use(express.json());

  const apiKeyGuard = buildApiKeyGuard(config, env.API_KEY);

  app.use(buildStreamableHttpRouter(apiKeyGuard, services));
  app.use(buildSSERouter(apiKeyGuard, services));
  app.use(buildAdminRouter(apiKeyGuard, services));

  return server;
}
