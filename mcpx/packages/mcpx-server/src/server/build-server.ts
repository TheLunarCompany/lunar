import {
  compileRanges,
  makeIpAllowlistMiddleware,
} from "@mcpx/toolkit-core/ip-access";
import { accessLogFor } from "@mcpx/toolkit-core/logging";
import cors from "cors";
import express from "express";
import { createServer, Server } from "http";
import { Logger } from "winston";
import { ConfigService } from "../config.js";
import { env } from "../env.js";
import { Services } from "../services/services.js";
import { buildAdminRouter } from "./admin.js";
import { buildAuthMcpxRouter } from "./auth-mcpx.js";
import { buildIdentityRouter } from "./identity.js";
import { buildApiKeyGuard } from "./auth.js";
import { buildControlPlaneAppConfigRouter } from "./control-plane-app-config.js";
import { buildControlPlaneRouter } from "./control-plane.js";
import { makeHubConnectionGuard } from "./hub-connection-guard.js";
import { buildOAuthRouter } from "./oauth-router.js";
import { buildCatalogRouter } from "./servers-catalog.js";
import { buildDownstreamTransportsRouter } from "./downstream-transports.js";
import { bindUIWebsocket } from "./ws-ui.js";
import { LOG_FLAGS } from "../log-flags.js";

export async function buildMcpxServer(
  config: ConfigService,
  services: Services,
  allowedIpARanged: ReturnType<typeof compileRanges> | undefined,
  logger: Logger,
): Promise<Server> {
  const app = express();
  const server = createServer(app);

  // Configure CORS for UI requests
  // Default to localhost:5173 (UI dev server) if CORS_ORIGINS is not set
  const corsOrigin = env.CORS_ORIGINS || [
    `http://localhost:${env.UI_PORT}`,
    `http://127.0.0.1:${env.UI_PORT}`,
  ];
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "Mcp-Session-Id",
        "MCP-Protocol-Version",
        "Last-Event-ID",
      ],
      exposedHeaders: ["Mcp-Session-Id"],
    }),
  );

  app.use(makeIpAllowlistMiddleware(allowedIpARanged, logger));
  app.use(
    accessLogFor(
      logger,
      [
        { method: "GET", path: "/healthcheck" },
        ...getIgnoredAccessLogRoutes(logger),
      ],
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
      services.upstreamHandler,
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

  // Hub connection guard - blocks all subsequent routes if hub connection is required
  const hubConnectionGuard = makeHubConnectionGuard(
    services.hubService,
    env.ENFORCE_HUB_CONNECTION,
    logger.child({ component: "HubConnectionGuard" }),
  );
  app.use(hubConnectionGuard);

  app.use(
    buildDownstreamTransportsRouter(
      authGuard,
      services,
      logger.child({ component: "DownstreamTransportsRouter" }),
    ),
  );
  app.use(
    "/admin",
    buildAdminRouter(
      authGuard,
      services,
      logger.child({ component: "AdminRouter" }),
    ),
  );
  app.use("/identity", buildIdentityRouter(authGuard, services));
  app.use(
    buildControlPlaneRouter(
      authGuard,
      services,
      logger.child({ component: "ControlPlaneRouter" }),
    ),
  );
  app.use(
    "/config",
    buildControlPlaneAppConfigRouter(
      authGuard,
      services,
      logger.child({ component: "ControlPlaneAppConfigRouter" }),
    ),
  );
  app.use(
    "/catalog",
    buildCatalogRouter(
      authGuard,
      services,
      logger.child({ component: "ServersCatalogRouter" }),
    ),
  );

  // Bind UI websocket
  bindUIWebsocket(server, services, logger.child({ component: "ws-ui" }));

  return server;
}

function getIgnoredAccessLogRoutes(
  logger: Logger,
): Array<{ method: string; path: string }> {
  if (LOG_FLAGS.LOG_CLIENT_ACCESS_LOG) {
    return [];
  }
  logger.info("Hiding client access logs for MCP endpoints");
  return [
    { method: "GET", path: "/mcp" },
    { method: "POST", path: "/mcp" },
    { method: "DELETE", path: "/mcp" },
  ];
}
