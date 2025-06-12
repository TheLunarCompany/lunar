import {
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
} from "@mcpx/shared-model/api";
import { Server as HTTPServer } from "http";
import { Socket, Server as WSServer } from "socket.io";
import { logger } from "../logger.js";
import { Services } from "../services/services.js";

export function bindUIWebsocket(server: HTTPServer, services: Services): void {
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
        handleWsEvent(services, socket, eventName, payload);
      });
    });

    io.on("disconnect", () => {
      logger.info("WebSocket server disconnected");
    });
  });
}

async function handleWsEvent(
  services: Services,
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
    case UI_ServerBoundMessage.GetSystemState: {
      logger.info("Fetching current system state");
      await services.dal.fetchCurrentSystemState().then((state) => {
        socket.emit(UI_ClientBoundMessage.SystemState, state);
      });
    }
  }

  logger.info(`Handled event: ${eventName}`, { id: socket.id });
}
