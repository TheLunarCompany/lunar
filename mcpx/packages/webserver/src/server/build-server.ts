import cors from "cors";
import express from "express";
import { buildWebserverRouter } from "./rest.js";
import { createServer, Server } from "http";
import { bindUIWebsocket } from "./ws-ui.js";
import { Services } from "../services/services.js";
import { bindMcpxHubWebsocket } from "./ws-mcpx.js";
import { accessLogFor } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

export function buildWebserverServer(
  services: Services,
  logger: Logger,
): Server {
  const app = express();
  const server = createServer(app);

  app.use(accessLogFor(logger, [{ method: "GET", path: "/healthcheck" }]));
  app.use(express.json());
  app.use(cors());

  app.get("/healthcheck", (_: express.Request, res: express.Response) => {
    res.send({ status: "OK" });
  });

  const webserverRouter = buildWebserverRouter(services);
  app.use(webserverRouter);
  bindUIWebsocket(server, services, logger.child({ component: "ws-ui" }));
  bindMcpxHubWebsocket(
    server,
    services,
    logger.child({ component: "ws-mcpx" }),
  );
  return server;
}
