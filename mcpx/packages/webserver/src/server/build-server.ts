import cors from "cors";
import express from "express";
import { accessLogFor, logger } from "../logger.js";
import { buildWebserverRouter } from "./rest.js";
import { createServer, Server } from "http";
import { bindUIWebsocket } from "./ws-ui.js";
import { Services } from "../services/services.js";
import { bindMcpxHubWebsocket } from "./ws-mcpx.js";

export function buildWebserverServer(services: Services): Server {
  const app = express();
  const server = createServer(app);

  app.use(accessLogFor(logger));
  app.use(express.json());
  app.use(cors());

  const webserverRouter = buildWebserverRouter(services);
  app.use(webserverRouter);
  bindUIWebsocket(server, services);
  bindMcpxHubWebsocket(server, services);
  return server;
}
