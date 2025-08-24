import {
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
} from "@mcpx/shared-model/api";
import { Server as HTTPServer } from "http";
import { Socket, Server as WSServer } from "socket.io";
import { Logger } from "winston";
import { Services } from "../services/services.js";
import { env } from "../env.js";

export function bindUIWebsocket(
  server: HTTPServer,
  services: Services,
  logger: Logger,
): void {
  const allowedOrigins = [
    `http://127.0.0.1:${env.UI_PORT}`,
    `http://localhost:${env.UI_PORT}`,
  ];
  
  // Add PUBLIC_HOST origins for remote access if PUBLIC_HOST is set and not localhost
  if (env.PUBLIC_HOST && env.PUBLIC_HOST !== '127.0.0.1' && env.PUBLIC_HOST !== 'localhost') {
    allowedOrigins.push(`http://${env.PUBLIC_HOST}:${env.UI_PORT}`);
    allowedOrigins.push(`https://${env.PUBLIC_HOST}:${env.UI_PORT}`);
  }

  const io = new WSServer(server, {
    path: "/ws-ui",
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.debug("UI connected:", { id: socket.id });
    services.connections.uiSocket = socket;

    socket.on("disconnect", () => {
      services.connections.uiSocket = null;
      logger.debug("UI disconnected:", { id: socket.id });
    });

    // Handle events from UI to the webserver
    Object.entries(UI_ServerBoundMessage).forEach(([_, eventName]) => {
      socket.on(eventName, async (payload) => {
        handleWsEvent(services, logger, socket, eventName, payload);
      });
    });

    io.on("disconnect", () => {
      logger.debug("WebSocket server disconnected");
    });
  });
}

async function handleWsEvent(
  services: Services,
  logger: Logger,
  socket: Socket,
  eventName: UI_ServerBoundMessage,
  _payload: unknown,
): Promise<void> {
  logger.debug(`Received event: ${eventName}`, {
    payload: _payload,
    id: socket.id,
  });

  // Here you can handle the event based on its type
  switch (eventName) {
    case UI_ServerBoundMessage.GetAppConfig: {
      logger.debug("Fetching current app config");
      await services.dal.fetchCurrentAppConfig().then((config) => {
        socket.emit(UI_ClientBoundMessage.AppConfig, config);
      });
      break;
    }
    case UI_ServerBoundMessage.GetSystemState: {
      logger.debug("Fetching current system state");
      await services.dal.fetchCurrentSystemState().then((state) => {
        socket.emit(UI_ClientBoundMessage.SystemState, state);
      });
      break;
    }
  }

  logger.debug(`Handled event: ${eventName}`, { id: socket.id });
}
