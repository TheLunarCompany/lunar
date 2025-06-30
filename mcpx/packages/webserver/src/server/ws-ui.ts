import {
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
} from "@mcpx/shared-model/api";
import { Server as HTTPServer } from "http";
import { Socket, Server as WSServer } from "socket.io";
import { Logger } from "winston";
import { Services } from "../services/services.js";

export function bindUIWebsocket(
  server: HTTPServer,
  services: Services,
  logger: Logger,
): void {
  const io = new WSServer(server, {
    path: "/ws-ui",
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.info("UI connected:", { id: socket.id });
    services.connections.uiSocket = socket;

    socket.on("disconnect", () => {
      services.connections.uiSocket = null;
      logger.info("UI disconnected:", { id: socket.id });
    });

    // Handle events from UI to the webserver
    Object.entries(UI_ServerBoundMessage).forEach(([_, eventName]) => {
      socket.on(eventName, async (payload) => {
        handleWsEvent(services, logger, socket, eventName, payload);
      });
    });

    io.on("disconnect", () => {
      logger.info("WebSocket server disconnected");
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
  logger.info(`Received event: ${eventName}`, {
    payload: _payload,
    id: socket.id,
  });

  // Here you can handle the event based on its type
  switch (eventName) {
    case UI_ServerBoundMessage.GetAppConfig: {
      logger.info("Fetching current app config");
      await services.dal.fetchCurrentAppConfig().then((config) => {
        socket.emit(UI_ClientBoundMessage.AppConfig, config);
      });
      break;
    }
    case UI_ServerBoundMessage.GetSystemState: {
      logger.info("Fetching current system state");
      await services.dal.fetchCurrentSystemState().then((state) => {
        socket.emit(UI_ClientBoundMessage.SystemState, state);
      });
      break;
    }
  }

  logger.info(`Handled event: ${eventName}`, { id: socket.id });
}
