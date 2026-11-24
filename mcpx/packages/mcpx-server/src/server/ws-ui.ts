import {
  UiClientBoundMessage,
  UiServerBoundMessage,
  WS_CONNECTION_ERROR,
} from "@mcpx/shared-model";
import { UIConnection } from "../services/connections.js";
import { Server as HTTPServer } from "http";
import { Socket, Server as WSServer } from "socket.io";
import { Logger } from "winston";
import { Services } from "../services/services.js";
import { toClientIdentity } from "../services/identity-service.js";
import { loggableError } from "@aigw/core/logging";
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
        socket.emit(UiClientBoundMessage.SystemState, systemState);
      });

    const activeCallCountCallback =
      services.controlPlane.subscribeToActiveCallCountUpdates(
        (activeCallCount) => {
          socket.emit(UiClientBoundMessage.ActiveCallCountChanged, {
            activeCallCount,
          });
        },
      );

    const appConfigCallback = services.controlPlane.subscribeToAppConfigUpdates(
      (configSnapshot: ConfigSnapshot) => {
        // Convert ConfigSnapshot to SerializedAppConfig
        const yaml = stringify(configSnapshot.config);
        socket.emit(UiClientBoundMessage.AppConfig, {
          yaml,
          version: configSnapshot.version,
          lastModified: configSnapshot.lastModified,
        });
      },
    );

    const identityCallback = services.identityService.subscribe((identity) => {
      socket.emit(UiClientBoundMessage.IdentityChanged, {
        identity: toClientIdentity(identity),
      });
    });

    services.connections.addSession(
      new UIConnection({
        socket,
        systemStateCallback,
        activeCallCountCallback,
        appConfigCallback,
        identityCallback,
      }),
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
    Object.entries(UiServerBoundMessage).forEach(([_, eventName]) => {
      socket.on(eventName, async (payload) => {
        await handleWsEvent(services, logger, socket, eventName, payload);
      });
    });
  });
}

async function handleWsEvent(
  services: Services,
  logger: Logger,
  socket: Socket,
  eventName: UiServerBoundMessage,
  payload: unknown,
): Promise<void> {
  logger.debug(`Received event: ${eventName}`, {
    payload: payload,
    id: socket.id,
  });

  try {
    switch (eventName) {
      case UiServerBoundMessage.GetAppConfig: {
        logger.debug("Fetching current app config");
        const appConfig = services.controlPlane.getAppConfig();
        socket.emit(UiClientBoundMessage.AppConfig, appConfig);
        break;
      }
      case UiServerBoundMessage.GetSystemState: {
        logger.debug("Fetching current system state");
        const systemState = services.controlPlane.getSystemState();
        socket.emit(UiClientBoundMessage.SystemState, systemState);
        break;
      }
      case UiServerBoundMessage.SetDynamicCapabilities: {
        // Handling is wired in a later change.
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
