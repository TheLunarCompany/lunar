import {
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
  UpdateTargetServerRequest,
  applyRawAppConfigRequestSchema,
  createTargetServerRequestSchema,
} from "@mcpx/shared-model";
import { Server as HTTPServer } from "http";
import { Socket, Server as WSServer } from "socket.io";
import { Logger } from "winston";
import { Services } from "../services/services.js";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { env } from "../env.js";

export function bindUIWebsocket(
  server: HTTPServer,
  services: Services,
  logger: Logger,
): void {
  const io = new WSServer(server, {
    path: "/ws-ui",
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });

  const unsubscribeSystemState = services.systemStateTracker.subscribe(
    (systemState) => {
      logger.debug("System state updated, broadcasting to UI clients");
      try {
        // Broadcast to all connected UI clients
        io.emit(UI_ClientBoundMessage.SystemState, systemState);
      } catch (error) {
        logger.error("Failed to broadcast system state update to UI", {
          error,
        });
      }
    },
  );

  io.on("connection", (socket) => {
    logger.debug("UI connected:", { id: socket.id });
    services.connections.uiSocket = socket;

    socket.on("disconnect", () => {
      services.connections.uiSocket = null;
      logger.debug("UI disconnected:", { id: socket.id });
    });

    // Handle events from UI
    Object.entries(UI_ServerBoundMessage).forEach(([_, eventName]) => {
      socket.on(eventName, async (payload) => {
        handleWsEvent(services, logger, socket, eventName, payload);
      });
    });
  });

  // Clean up subscription when server shuts down
  server.on("close", () => {
    unsubscribeSystemState();
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
      case UI_ServerBoundMessage.PatchAppConfig: {
        logger.debug("Patching app config");
        try {
          // Validate and parse the raw YAML payload
          const parseResult = applyRawAppConfigRequestSchema.safeParse(payload);
          if (!parseResult.success) {
            logger.error("Invalid raw app config request", {
              error: parseResult.error,
              payload: payload,
            });
            socket.emit(UI_ClientBoundMessage.PatchAppConfigFailed, {
              error: `Invalid request format: ${parseResult.error.message}`,
            });
            break;
          }

          // The schema already parsed the YAML, so we can use it directly
          const parsedConfig = parseResult.data.yaml;
          await services.controlPlane.patchAppConfig(parsedConfig);

          // Send back the updated config
          const updatedConfig = services.controlPlane.getAppConfig();
          socket.emit(UI_ClientBoundMessage.AppConfig, updatedConfig);
        } catch (e) {
          const error = loggableError(e);
          logger.error("Failed to patch app config", {
            error,
            payload: payload,
          });
          socket.emit(UI_ClientBoundMessage.PatchAppConfigFailed, {
            error: error.errorMessage,
          });
        }
        break;
      }
      case UI_ServerBoundMessage.AddTargetServer: {
        logger.debug("Adding target server");
        const parseResult = createTargetServerRequestSchema.safeParse(payload);
        if (!parseResult.success) {
          logger.error("Invalid target server payload", {
            error: parseResult.error,
            payload,
          });
          socket.emit(UI_ClientBoundMessage.AddTargetServerFailed, {
            error: "Invalid server configuration",
          });
          break;
        }
        const targetServerPayload = parseResult.data;
        try {
          const result =
            await services.controlPlane.addTargetServer(targetServerPayload);
          socket.emit(UI_ClientBoundMessage.TargetServerAdded, result);
          // System state will be automatically broadcast via subscription
        } catch (e) {
          const error = loggableError(e);
          logger.error("Failed to add target server", {
            error,
            payload: targetServerPayload,
          });
          socket.emit(UI_ClientBoundMessage.AddTargetServerFailed, {
            error: error.errorMessage,
          });
        }
        break;
      }
      case UI_ServerBoundMessage.RemoveTargetServer: {
        logger.debug("Removing target server");
        const removePayload = payload as { name: string };
        try {
          await services.controlPlane.removeTargetServer(removePayload.name);
          socket.emit(UI_ClientBoundMessage.TargetServerRemoved, removePayload);
          // System state will be automatically broadcast via subscription
        } catch (e) {
          const error = loggableError(e);
          logger.error("Failed to remove target server", {
            error,
            payload: removePayload,
          });
          socket.emit(UI_ClientBoundMessage.RemoveTargetServerFailed, {
            error: error.errorMessage,
          });
        }
        break;
      }
      case UI_ServerBoundMessage.UpdateTargetServer: {
        logger.debug("Updating target server");
        const { name, data } = payload as {
          name: string;
          data: UpdateTargetServerRequest;
        };
        try {
          const result = await services.controlPlane.updateTargetServer(
            name,
            data,
          );
          socket.emit(UI_ClientBoundMessage.TargetServerUpdated, result);
          // System state will be automatically broadcast via subscription
        } catch (e) {
          const error = loggableError(e);
          logger.error("Failed to update target server", { error, name, data });
          socket.emit(UI_ClientBoundMessage.UpdateTargetServerFailed, {
            error: error.errorMessage,
          });
        }
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
