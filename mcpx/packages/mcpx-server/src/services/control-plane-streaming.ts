import {
  ApplyParsedAppConfigRequest,
  ManageTargetServerFailure,
  MCPXToWebserverMessage,
  SerializedAppConfig,
  SystemState,
  TargetServerName,
  TargetServerRequest,
  updateTargetServerRequestSchema,
  WebserverToMCPXMessage,
} from "@mcpx/shared-model";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { io, Socket } from "socket.io-client";
import { Logger } from "winston";
import z from "zod/v4";
import { env } from "../env.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { ControlPlaneService } from "./control-plane-service.js";

type Message =
  | {
      name: MCPXToWebserverMessage.SystemState;
      payload: SystemState;
    }
  | {
      name: MCPXToWebserverMessage.AppConfig;
      payload: SerializedAppConfig;
    }
  | {
      name: MCPXToWebserverMessage.TargetServerAdded;
      payload: TargetServerName;
    }
  | {
      name: MCPXToWebserverMessage.TargetServerRemoved;
      payload: TargetServerName;
    }
  | {
      name: MCPXToWebserverMessage.TargetServerUpdated;
      payload: TargetServerName;
    };

type ErrorMessage =
  | {
      name: MCPXToWebserverMessage.PatchAppConfigFailed;
      payload: string;
    }
  | {
      name: MCPXToWebserverMessage.AddTargetServerFailed;
      payload: { failure: ManageTargetServerFailure };
    }
  | {
      name: MCPXToWebserverMessage.UpdateTargetServerFailed;
      payload: { failure: ManageTargetServerFailure };
    }
  | {
      name: MCPXToWebserverMessage.RemoveTargetServerFailed;
      payload: { failure: ManageTargetServerFailure };
    };

export interface ControlPlaneStreamingClientI {
  shutdown(): void;
}

export function buildControlPlaneStreaming(
  controlPlane: ControlPlaneService,
  logger: Logger,
): ControlPlaneStreamingClientI {
  if (env.ENABLE_CONTROL_PLANE_STREAMING) {
    return new ControlPlaneStreamingClient(controlPlane, logger);
  }
  logger.warn(
    "ControlPlaneStreaming is disabled, using NoOpControlPlaneStreamingClient",
  );
  return new NoOpControlPlaneStreamingClient();
}
export class NoOpControlPlaneStreamingClient {
  shutdown(): void {}
}

export class ControlPlaneStreamingClient {
  private socket: Socket;
  private controlPlane: ControlPlaneService;
  private logger: Logger;

  constructor(controlPlane: ControlPlaneService, logger: Logger) {
    this.socket = io(env.CONTROL_PLANE_HOST, { path: "/ws-mcpx-hub" });

    this.controlPlane = controlPlane;
    this.logger = logger.child({ component: "ControlPlaneStreamingClient" });

    this.setupEventHandlers();
  }

  shutdown(): void {
    this.logger.info("Shutting down ControlPlaneStreamingClient...");
    this.socket.close();
  }

  private send(message: Message | ErrorMessage): void {
    this.logger.debug(`Sending message to Control Plane: ${message.name}`, {
      payload: message.payload,
    });
    this.socket.emit(message.name, message.payload);
  }

  private setupEventHandlers(): void {
    this.socket.on("connect_error", (e) => {
      const error = loggableError(e);
      const stack = this.logger.isDebugEnabled() ? error.errorStack : undefined;
      this.logger.info("Failed connecting to Control Plane", {
        error: error.errorMessage,
        stack,
      });
    });

    this.socket.on("connect", () => {
      // Send initial app config
      this.send({
        name: MCPXToWebserverMessage.AppConfig,
        payload: this.controlPlane.getAppConfig(),
      });
      // TODO: subscribe to config updates?

      // Send initial system state
      this.send({
        name: MCPXToWebserverMessage.SystemState,
        payload: this.controlPlane.getSystemState(),
      });

      // Subscribe to updates
      this.controlPlane.subscribeToAppConfigUpdates((payload) => {
        this.send({ name: MCPXToWebserverMessage.AppConfig, payload });
      });
      this.controlPlane.subscribeToSystemStateUpdates((payload) => {
        this.send({ name: MCPXToWebserverMessage.SystemState, payload });
      });
      this.logger.info("Connected to Control Plane");
    });

    this.socket.on(WebserverToMCPXMessage.GetSystemState, () => {
      const payload = this.controlPlane.getSystemState();
      this.send({ name: MCPXToWebserverMessage.SystemState, payload });
    });

    this.socket.on(WebserverToMCPXMessage.GetAppConfig, () => {
      const payload = this.controlPlane.getAppConfig();
      this.send({ name: MCPXToWebserverMessage.AppConfig, payload });
    });

    this.socket.on(
      WebserverToMCPXMessage.PatchAppConfig,
      async (payload: ApplyParsedAppConfigRequest) => {
        try {
          const updatedAppConfig =
            await this.controlPlane.patchAppConfig(payload);
          this.send({
            name: MCPXToWebserverMessage.AppConfig,
            payload: updatedAppConfig,
          });
        } catch (e) {
          if (e instanceof z.ZodError) {
            this.send({
              name: MCPXToWebserverMessage.PatchAppConfigFailed,
              payload: `Invalid config schema: ${z.treeifyError(e)}`,
            });
          }
          const error = loggableError(e);
          this.logger.error("Error in PatchAppConfig request", {
            payload,
            error,
          });
          this.send({
            name: MCPXToWebserverMessage.PatchAppConfigFailed,
            payload: `Internal server error: ${error.errorMessage}`,
          });
          return;
        }
      },
    );

    this.socket.on(
      WebserverToMCPXMessage.AddTargetServer,
      async (data: TargetServerRequest) => {
        try {
          await this.controlPlane.addTargetServer(data);
          this.send({
            name: MCPXToWebserverMessage.TargetServerAdded,
            payload: { name: data.name },
          });
        } catch (e: unknown) {
          if (e instanceof FailedToConnectToTargetServer) {
            this.send({
              name: MCPXToWebserverMessage.AddTargetServerFailed,
              payload: {
                failure: ManageTargetServerFailure.FailedToConnect,
              },
            });
            return;
          }
          if (e instanceof AlreadyExistsError) {
            this.send({
              name: MCPXToWebserverMessage.AddTargetServerFailed,
              payload: { failure: ManageTargetServerFailure.AlreadyExists },
            });
            return;
          }
          const error = loggableError(e);
          this.logger.error("Error creating target server", {
            error,
            data,
          });
          this.send({
            name: MCPXToWebserverMessage.AddTargetServerFailed,
            payload: { failure: ManageTargetServerFailure.InternalServerError },
          });
        }
      },
    );

    this.socket.on(
      WebserverToMCPXMessage.UpdateTargetServer,
      async (
        data: z.infer<typeof updateTargetServerRequestSchema> &
          TargetServerName,
      ) => {
        const { name, ...rest } = data;
        try {
          await this.controlPlane.updateTargetServer(name, rest);
          this.send({
            name: MCPXToWebserverMessage.TargetServerUpdated,
            payload: { name: data.name },
          });
        } catch (e) {
          if (e instanceof NotFoundError) {
            this.logger.error(`Target server ${data.name} not found`, { data });
            this.send({
              name: MCPXToWebserverMessage.UpdateTargetServerFailed,
              payload: { failure: ManageTargetServerFailure.NotFound },
            });
            return;
          }
          const error = loggableError(e);
          this.logger.error("Error updating target server", { error, data });
          this.send({
            name: MCPXToWebserverMessage.UpdateTargetServerFailed,
            payload: { failure: ManageTargetServerFailure.InternalServerError },
          });
          return;
        }
      },
    );

    this.socket.on(
      WebserverToMCPXMessage.RemoveTargetServer,
      async (payload: { name: string }) => {
        const { name } = payload;
        try {
          await this.controlPlane.removeTargetServer(name);
        } catch (e) {
          if (e instanceof NotFoundError) {
            this.logger.error(`Target server ${name} not found`, { name });
            this.send({
              name: MCPXToWebserverMessage.RemoveTargetServerFailed,
              payload: { failure: ManageTargetServerFailure.NotFound },
            });
            return;
          }
          const error = loggableError(e);
          this.logger.error("Error removing target server", { error, name });
          this.send({
            name: MCPXToWebserverMessage.RemoveTargetServerFailed,
            payload: { failure: ManageTargetServerFailure.InternalServerError },
          });
        }
      },
    );
  }
}
