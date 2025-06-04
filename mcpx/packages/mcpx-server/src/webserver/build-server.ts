import express from "express";
import { accessLogFor, webserverLogger } from "../logger.js";
import { buildWebserverRouter } from "./rest.js";
import { createServer, Server } from "http";
import { bindWebsocket } from "./ws.js";

export function buildWebserverServer(): Server {
  const app = express();
  const server = createServer(app);

  app.use(accessLogFor(webserverLogger));
  app.use(express.json());

  const webserverRouter = buildWebserverRouter();
  app.use(webserverRouter);
  bindWebsocket(server);
  return server;
}
