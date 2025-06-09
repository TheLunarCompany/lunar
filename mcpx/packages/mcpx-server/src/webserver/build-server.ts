import cors from "cors";
import express from "express";
import { accessLogFor, webserverLogger } from "../logger.js";
import { buildWebserverRouter } from "./rest.js";
import { createServer, Server } from "http";
import { bindWebsocket } from "./ws.js";
import { Services } from "../services/services.js";
import { ConfigManager } from "../config.js";

export function buildWebserverServer(
  config: ConfigManager,
  services: Services,
): Server {
  const app = express();
  const server = createServer(app);

  app.use(accessLogFor(webserverLogger));
  app.use(express.json());
  app.use(cors());

  const webserverRouter = buildWebserverRouter(config, services);
  app.use(webserverRouter);
  bindWebsocket(server, services);
  return server;
}
