import {
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
  WS_CONNECTION_ERROR,
} from "@mcpx/shared-model";
import { UIConnection } from "../services/connections.js";
import { Server as HTTPServer } from "http";
import { Socket, Server as WSServer } from "socket.io";
import { Logger } from "winston";
import { Services } from "../services/services.js";
import { toClientIdentity } from "../services/identity-service.js";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { env } from "../env.js";
import { checkHubConnection } from "./hub-connection-guard.js";
import { ConfigSnapshot } from "../config.js";
import { stringify } from "yaml";

export function bindUIWebsocket(
  server: HTTPServer,
  services: Services,
  logger: Logger,
): void {
  const io = new WSServer(server, {
    path: "/ws-ui",
    cors: {
      origin: env.CORS_ORIGINS || "*",
      credentials: true,
    },
  });

  // Middleware to check hub connection before allowing websocket connections
  io.use((socket, next) => {
    const connectionCheck = checkHubConnection(
      services.hubService,
      env.ENFORCE_HUB_CONNECTION,
    );

    if (!connectionCheck.allowed) {
      logger.warn("WebSocket connection rejected - hub not connected", {
        id: socket.id,
        status: connectionCheck.status,
        connectionError: connectionCheck.connectionError?.toJSON(),
      });
      const err = new Error(WS_CONNECTION_ERROR.HUB_NOT_CONNECTED);
      return next(err);
    }

    next();
  });

  io.on("connection", (socket) => {
    logger.debug("WebSocket connection established", {
      id: socket.id,
    });

    const systemStateCallback =
      services.controlPlane.subscribeToSystemStateUpdates((systemState) => {
        socket.emit(UI_ClientBoundMessage.SystemState, systemState);
      });

    const appConfigCallback = services.controlPlane.subscribeToAppConfigUpdates(
      (configSnapshot: ConfigSnapshot) => {
        // Convert ConfigSnapshot to SerializedAppConfig
        const yaml = stringify(configSnapshot.config);
        socket.emit(UI_ClientBoundMessage.AppConfig, {
          yaml,
          version: configSnapshot.version,
          lastModified: configSnapshot.lastModified,
        });
      },
    );

    const identityCallback = services.identityService.subscribe((identity) => {
      socket.emit(UI_ClientBoundMessage.IdentityChanged, {
        identity: toClientIdentity(identity),
      });
    });

    services.connections.addSession(
      new UIConnection(
        socket,
        systemStateCallback,
        appConfigCallback,
        identityCallback,
      ),
    );
    logger.debug("UI sessions updated", {
      totalSessions: services.connections.size(),
      allSessionIds: services.connections.getSessionIds(),
    });

    socket.on("disconnect", () => {
      services.connections.removeSession(socket.id);
      logger.debug("UI disconnected:", {
        id: socket.id,
        totalSessions: services.connections.size(),
        remainingSessions: services.connections.getSessionIds(),
      });
    });

    // Handle events from UI
    Object.entries(UI_ServerBoundMessage).forEach(([_, eventName]) => {
      socket.on(eventName, async (payload) => {
        handleWsEvent(services, logger, socket, eventName, payload);
      });
    });
  });
}

async function handleWsEvent(
  services: Services,
  logger: Logger,
  socket: Socket,
  eventName: UI_ServerBoundMessage,
  payload: unknown,
): Promise<void> {
  logger.debug(`Received event: ${eventName}`, {
    payload: payload,
    id: socket.id,
  });

  try {
    switch (eventName) {
      case UI_ServerBoundMessage.GetAppConfig: {
        logger.debug("Fetching current app config");
        const appConfig = services.controlPlane.getAppConfig();
        socket.emit(UI_ClientBoundMessage.AppConfig, appConfig);
        break;
      }
      case UI_ServerBoundMessage.GetSystemState: {
        logger.debug("Fetching current system state");
        const systemState = services.controlPlane.getSystemState();
        socket.emit(UI_ClientBoundMessage.SystemState, systemState);
        break;
      }
      default: {
        logger.warn(`Unhandled event: ${eventName}`, {
          id: socket.id,
          payload: payload,
        });
        break;
      }
    }
  } catch (e) {
    const error = loggableError(e);
    logger.error(`Error handling event: ${eventName}`, {
      error,
      id: socket.id,
      payload: payload,
    });
  }

  logger.debug(`Handled event: ${eventName}`, { id: socket.id });
}
