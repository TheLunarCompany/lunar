import { ClientBoundMessage, ServerBoundMessage } from "@mcpx/shared-model/api";
import { Server as HTTPServer } from "http";
import { Socket, Server as WSServer } from "socket.io";
import { webserverLogger } from "../logger.js";
import { Services } from "../services/services.js";

export function bindWebsocket(server: HTTPServer, services: Services): void {
  const io = new WSServer(server);

  io.on("connection", (socket) => {
    webserverLogger.info("A user connected:", { id: socket.id });

    socket.on("disconnect", () => {
      webserverLogger.info("A user disconnected:", { id: socket.id });
    });

    Object.entries(ServerBoundMessage).forEach(([_, eventName]) => {
      socket.on(eventName, async (payload) => {
        handleWsEvent(services, socket, eventName, payload);
      });
    });

    const unsubscribeF = services.metricRecorder.subscribe((snapshot) => {
      socket.emit(ClientBoundMessage.SystemState, snapshot);
    });

    io.on("disconnect", () => {
      webserverLogger.info("WebSocket server disconnected");
      unsubscribeF();
    });
  });
}

function handleWsEvent(
  services: Services,
  socket: Socket,
  eventName: ServerBoundMessage,
  _payload: unknown,
): void {
  webserverLogger.info(`Received event: ${eventName}`, {
    payload: _payload,
    id: socket.id,
  });

  // Here you can handle the event based on its type
  switch (eventName) {
    case ServerBoundMessage.GetSystemState:
      try {
        const systemState = services.metricRecorder.export();
        socket.emit(ClientBoundMessage.SystemState, systemState);
        break;
      } catch (error) {
        socket.emit(ClientBoundMessage.GetSystemStateFailed, { error });
        break;
      }
  }

  webserverLogger.info(`Handled event: ${eventName}`, { id: socket.id });
}
