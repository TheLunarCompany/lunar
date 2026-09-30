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
import { ConfigService, ConfigSnapshot } from "../config.js";
import { parse, stringify } from "yaml";
import { checkSocketAuth } from "./auth.js";
import { redactConfigSecrets } from "../services/redact.js";

export function bindUIWebsocket(
  server: HTTPServer,
  services: Services,
  logger: Logger,
  configService?: ConfigService,
  apiKey?: string,
): void {
  const io = new WSServer(server, {
    path: "/ws-ui",
    cors: {
      origin: env.CORS_ORIGINS || "*",
      credentials: true,
    },
  });

  // Middleware to check authentication and hub connection before allowing websocket connections
  io.use((socket, next) => {
    if (configService) {
      const authCheck = checkSocketAuth(
        configService,
        logger,
        apiKey,
        socket.handshake.headers,
        socket.handshake.auth,
      );

      if (!authCheck.allowed) {
        logger.warn("WebSocket connection rejected - authentication failed", {
          id: socket.id,
          error: authCheck.error,
        });
        const err = new Error(authCheck.error);
        return next(err);
      }
    }

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

    const activeCallCountCallback =
      services.controlPlane.subscribeToActiveCallCountUpdates(
        (activeCallCount) => {
          socket.emit(UI_ClientBoundMessage.ActiveCallCountChanged, {
            activeCallCount,
          });
        },
      );

    const appConfigCallback = services.controlPlane.subscribeToAppConfigUpdates(
      (configSnapshot: ConfigSnapshot) => {
        // Convert ConfigSnapshot to SerializedAppConfig with secrets redacted
        const sanitized = redactConfigSecrets(configSnapshot.config);
        const yaml = stringify(sanitized);
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
        activeCallCountCallback,
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
        try {
          const parsed = parse(appConfig.yaml);
          const sanitized = redactConfigSecrets(parsed);
          socket.emit(UI_ClientBoundMessage.AppConfig, {
            ...appConfig,
            yaml: stringify(sanitized),
          });
        } catch {
          socket.emit(UI_ClientBoundMessage.AppConfig, appConfig);
        }
        break;
      }
      case UI_ServerBoundMessage.GetSystemState: {
        logger.debug("Fetching current system state");
        const systemState = services.controlPlane.getSystemState();
        socket.emit(UI_ClientBoundMessage.SystemState, systemState);
        break;
      }
      case UI_ServerBoundMessage.SetDynamicCapabilities: {
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
