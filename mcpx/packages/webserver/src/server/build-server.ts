import { accessLogFor } from "@mcpx/toolkit-core/logging";
import cors from "cors";
import express from "express";
import { createServer, Server } from "http";
import { Logger } from "winston";
import { Services } from "../services/services.js";
import { buildWebserverRouter } from "./rest.js";
import { bindMcpxHubWebsocket } from "./ws-mcpx.js";
import { bindUIWebsocket } from "./ws-ui.js";
import { env } from "../env.js";

export function buildWebserverServer(
  services: Services,
  logger: Logger,
): Server {
  const app = express();
  const server = createServer(app);

  app.use(
    accessLogFor(
      logger,
      [{ method: "GET", path: "/healthcheck" }],
      env.ACCESS_LOG_LEVEL,
    ),
  );
  app.use(express.json());
  app.use(cors());

  app.get("/healthcheck", (_: express.Request, res: express.Response) => {
    res.send({ status: "OK" });
  });

  const webserverRouter = buildWebserverRouter(
    services,
    logger.child({ component: "rest" }),
  );
  app.use(webserverRouter);
  bindUIWebsocket(server, services, logger.child({ component: "ws-ui" }));
  bindMcpxHubWebsocket(
    server,
    services,
    logger.child({ component: "ws-mcpx" }),
  );
  return server;
}
