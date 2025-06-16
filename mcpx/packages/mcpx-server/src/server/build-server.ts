import express from "express";
import { createServer, Server } from "http";
import { ConfigManager } from "../config.js";
import { env } from "../env.js";
import { Services } from "../services/services.js";
import { buildAdminRouter } from "./admin.js";
import { buildApiKeyGuard } from "./auth.js";
import { buildSSERouter } from "./sse.js";
import { buildStreamableHttpRouter } from "./streamable.js";
import { accessLogFor } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

export async function buildMcpxServer(
  config: ConfigManager,
  services: Services,
  logger: Logger,
): Promise<Server> {
  const app = express();
  const server = createServer(app);

  app.use(accessLogFor(logger));
  app.use(express.json());

  const apiKeyGuard = buildApiKeyGuard(config, logger, env.LUNAR_API_KEY);

  app.use(
    buildStreamableHttpRouter(
      apiKeyGuard,
      services,
      logger.child({ component: "StreamableHttpRouter" }),
    ),
  );
  app.use(
    buildSSERouter(
      apiKeyGuard,
      services,
      logger.child({ component: "SseRouter" }),
    ),
  );
  app.use(
    buildAdminRouter(
      apiKeyGuard,
      services,
      logger.child({ component: "AdminRouter" }),
    ),
  );

  return server;
}
