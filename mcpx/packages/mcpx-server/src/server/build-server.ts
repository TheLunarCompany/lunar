import express from "express";
import { createServer, Server } from "http";
import cors from "cors";
import { ConfigService } from "../config.js";
import { env } from "../env.js";
import { Services } from "../services/services.js";
import { buildAdminRouter } from "./admin.js";
import { buildApiKeyGuard } from "./auth.js";
import { buildSSERouter } from "./sse.js";
import { buildStreamableHttpRouter } from "./streamable.js";
import { accessLogFor } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import { buildControlPlaneRouter } from "./control-plane.js";
import { buildOAuthRouter } from "./oauth-router.js";
import { buildAuthMcpxRouter } from "./auth-mcpx.js";
import { bindUIWebsocket } from "./ws-ui.js";
import {
  compileRanges,
  makeIpAllowlistMiddleware,
} from "@mcpx/toolkit-core/ip-access";

export async function buildMcpxServer(
  config: ConfigService,
  services: Services,
  allowedIpARanged: ReturnType<typeof compileRanges> | undefined,
  logger: Logger,
): Promise<Server> {
  const app = express();
  const server = createServer(app);

  // Configure CORS for UI requests
  app.use(
    cors({
      origin: env.CORS_ORIGINS || "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    }),
  );

  app.use(makeIpAllowlistMiddleware(allowedIpARanged, logger));
  app.use(
    accessLogFor(
      logger,
      [{ method: "GET", path: "/healthcheck" }],
      env.ACCESS_LOG_LEVEL,
    ),
  );
  app.use(express.json()); // Crucial - MCP routes expect JSON bodies!

  app.get("/healthcheck", (_: express.Request, res: express.Response) => {
    res.send({ status: "OK" });
  });

  const authGuard = buildApiKeyGuard(config, logger, env.AUTH_KEY);

  // OAuth endpoints (public - no auth guard needed)
  app.use(
    buildOAuthRouter(
      services.oauthSessionManager,
      logger.child({ component: "OAuthRouter" }),
    ),
  );

  // Auth MCPX endpoints (public - no auth guard needed)
  app.use(
    buildAuthMcpxRouter(
      services.hubService,
      logger.child({ component: "AuthMcpxRouter" }),
    ),
  );

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

  // Bind UI websocket
  bindUIWebsocket(server, services, logger.child({ component: "ws-ui" }));

  return server;
}
