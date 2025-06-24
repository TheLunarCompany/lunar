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
import { buildControlPlaneRouter } from "./control-plane.js";

export async function buildMcpxServer(
  config: ConfigManager,
  services: Services,
  logger: Logger,
): Promise<Server> {
  const app = express();
  const server = createServer(app);

  app.use(accessLogFor(logger));
  app.use(express.json());

  app.get("/healthcheck", (_: express.Request, res: express.Response) => {
    res.send({ status: "OK" });
  });

  const authGuard = buildApiKeyGuard(config, logger, env.AUTH_KEY);

  app.use(
    buildStreamableHttpRouter(
      authGuard,
      services,
      logger.child({ component: "StreamableHttpRouter" }),
    ),
  );
  app.use(
    buildSSERouter(
      authGuard,
      services,
      logger.child({ component: "SseRouter" }),
    ),
  );
  app.use(
    buildAdminRouter(
      authGuard,
      services,
      logger.child({ component: "AdminRouter" }),
    ),
  );
  app.use(
    buildControlPlaneRouter(
      authGuard,
      services,
      logger.child({ component: "ControlPlaneRouter" }),
    ),
  );

  return server;
}
