import {
  MCPXToWebserverMessage,
  SerializedAppConfig,
  SystemState,
  UI_ClientBoundMessage,
} from "@mcpx/shared-model/api";
import { Server as HTTPServer } from "http";
import { Socket, Server as WSServer } from "socket.io";
import { Logger } from "winston";
import { Services } from "../services/services.js";

export function bindMcpxHubWebsocket(
  server: HTTPServer,
  services: Services,
  logger: Logger,
): void {
  const io = new WSServer(server, {
    path: "/ws-mcpx-hub",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.info("mcpx instance connected:", { id: socket.id });
    services.connections.mcpxSocket = socket;

    socket.on("disconnect", () => {
      services.connections.mcpxSocket = null;
      logger.info("mcpx instance disconnected:", { id: socket.id });
    });

    // Handle events from MCPX to the webserver
    Object.entries(MCPXToWebserverMessage).forEach(([_, eventName]) => {
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
  eventName: MCPXToWebserverMessage,
  _payload: unknown,
): Promise<void> {
  logger.info(`Received event: ${eventName}`, {
    payload: _payload,
    id: socket.id,
  });

  switch (eventName) {
    case MCPXToWebserverMessage.SystemState: {
      await services.dal.updateCurrentSystemState(_payload as SystemState);
      services.connections.uiSocket?.emit(
        UI_ClientBoundMessage.SystemState,
        _payload as SystemState,
      );
      break;
    }
    case MCPXToWebserverMessage.AppConfig: {
      await services.dal.updateCurrentAppConfig(
        _payload as SerializedAppConfig,
      );
      services.connections.uiSocket?.emit(
        UI_ClientBoundMessage.AppConfig,
        _payload as SerializedAppConfig,
      );
      break;
    }
    // TODO: handle other events - failure and accepted events
    default: {
      logger.warn(`Unhandled event: ${eventName}`, {
        id: socket.id,
        payload: _payload,
      });
      break;
    }
  }

  logger.info(`Handled event: ${eventName}`, { id: socket.id });
}
