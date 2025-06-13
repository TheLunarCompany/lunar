import {
  ApplyParsedAppConfigRequest,
  WebserverToMCPXMessage,
  MCPXToWebserverMessage,
  ManageTargetServerFailure,
  SerializedAppConfig,
  SystemState,
  TargetServerName,
  TargetServerRequest,
} from "@mcpx/shared-model";
import { io, Socket } from "socket.io-client";
import { stringify } from "yaml";
import z from "zod/v4";
import { ConfigManager } from "../config.js";
import { env } from "../env.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { configSchema } from "../model.js";
import { SystemStateTracker } from "./system-state.js";
import { SessionsManager } from "./sessions.js";
import { TargetClients } from "./target-clients.js";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

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

export interface HubClientI {
  shutdown(): void;
}

export function buildHubClient(
  metricRecorder: SystemStateTracker,
  targetClients: TargetClients,
  sessions: SessionsManager,
  configManager: ConfigManager,
  logger: Logger,
): HubClientI {
  if (env.ENABLE_HUB) {
    return new HubClient(
      metricRecorder,
      targetClients,
      sessions,
      configManager,
      logger,
    );
  }
  logger.warn("HubClient is disabled, using NoOpHubClient");
  return new NoOpHubClient();
}
export class NoOpHubClient {
  shutdown(): void {}
}
// TODO make singleton
export class HubClient {
  private socket: Socket;
  private systemState: SystemStateTracker;
  private targetClients: TargetClients;
  private sessions: SessionsManager;
  private configManager: ConfigManager;
  private logger: Logger;

  constructor(
    metricRecorder: SystemStateTracker,
    targetClients: TargetClients,
    sessions: SessionsManager,
    configManager: ConfigManager,
    logger: Logger,
  ) {
    this.socket = io(env.HUB_HOST, { path: "/ws-mcpx-hub" });

    this.systemState = metricRecorder;
    this.targetClients = targetClients;
    this.sessions = sessions;
    this.configManager = configManager;
    this.logger = logger.child({ component: "HubClient" });

    this.setupEventHandlers();
  }

  shutdown(): void {
    this.logger.info("Shutting down HubClient...");
    this.socket.close();
  }

  private send(message: Message | ErrorMessage): void {
    this.logger.info(`Sending message to hub: ${message.name}`, {
      payload: message.payload,
    });
    this.socket.emit(message.name, message.payload);
  }

  private setupEventHandlers(): void {
    this.socket.on("connect_error", (error) => {
      this.logger.error("Failed connecting to Hub", {
        message: error.message,
        stack: error.stack,
      });
    });

    this.socket.on("connect", () => {
      // Send initial system state
      const payload = this.systemState.export();
      this.send({ name: MCPXToWebserverMessage.SystemState, payload });

      // Subscribe to updates
      this.systemState.subscribe((payload) => {
        this.send({ name: MCPXToWebserverMessage.SystemState, payload });
      });
      this.logger.info("Connected to hub");
    });

    this.socket.on(WebserverToMCPXMessage.GetSystemState, () => {
      this.logger.info("Received GetSystemState event from hub");
      const payload = this.systemState.export();
      this.send({ name: MCPXToWebserverMessage.SystemState, payload });
    });

    this.socket.on(WebserverToMCPXMessage.GetAppConfig, () => {
      this.logger.info("Received GetAppConfig event from hub");
      const payload: SerializedAppConfig = {
        yaml: stringify(this.configManager.getConfig()),
        version: this.configManager.getVersion(),
        lastModified: this.configManager.getLastModified(),
      };
      this.send({ name: MCPXToWebserverMessage.AppConfig, payload });
    });

    this.socket.on(
      WebserverToMCPXMessage.PatchAppConfig,
      (payload: ApplyParsedAppConfigRequest) => {
        this.logger.info("Received PatchAppConfig event from hub");

        // `payload.obj` is expected to be a valid object, parsed from raw YAML,
        // however, webserver does not validate it according to config schema
        const parsedConfig = configSchema.safeParse(payload.obj);
        if (!parsedConfig.success) {
          this.logger.error("Invalid config schema in PatchAppConfig request", {
            payload,
            error: parsedConfig.error,
          });
          this.send({
            name: MCPXToWebserverMessage.PatchAppConfigFailed,
            payload: `Invalid config schema: ${z.treeifyError(parsedConfig.error)}`,
          });
          return;
        }

        this.configManager.updateConfig(parsedConfig.data);
        const updatedAppConfig: SerializedAppConfig = {
          yaml: stringify(this.configManager.getConfig()),
          version: this.configManager.getVersion(),
          lastModified: this.configManager.getLastModified(),
        };
        this.logger.info("App config updated successfully", {
          updatedAppConfig,
        });
        this.send({
          name: MCPXToWebserverMessage.AppConfig,
          payload: updatedAppConfig,
        });
      },
    );

    this.socket.on(
      WebserverToMCPXMessage.AddTargetServer,
      async (data: TargetServerRequest) => {
        this.logger.info("Received AddTargetServer event from hub");
        try {
          await this.targetClients.addClient(data);
          await this.sessions.shutdown();
          this.logger.info(`Target server ${data.name} created successfully`);
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
      async (data: TargetServerRequest) => {
        this.logger.info("Received UpdateTargetServer event from hub");
        const existingTargetServer = this.targetClients.getTargetServer(
          data.name,
        );

        if (!existingTargetServer) {
          this.logger.error(`Target server ${data.name} not found for update`, {
            data,
          });
          this.send({
            name: MCPXToWebserverMessage.UpdateTargetServerFailed,
            payload: { failure: ManageTargetServerFailure.NotFound },
          });
          return;
        }

        try {
          // TODO: replace with safe-swap technique:
          // Add new client with temp name, if successful, remove old client and rename new one
          // as non-failable operation
          await this.targetClients.removeClient(data.name);
          await this.targetClients.addClient(data);
          await this.sessions.shutdown();
          this.logger.info(`Target server ${data.name} updated successfully`);
          this.send({
            name: MCPXToWebserverMessage.TargetServerUpdated,
            payload: { name: data.name },
          });
        } catch (e: unknown) {
          if (e instanceof FailedToConnectToTargetServer) {
            // Restore the previous target server state but notify about the failure
            await this.targetClients.addClient(existingTargetServer);
            this.send({
              name: MCPXToWebserverMessage.UpdateTargetServerFailed,
              payload: { failure: ManageTargetServerFailure.FailedToConnect },
            });
            return;
          }

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
        this.logger.info("Received RemoveTargetServer event from hub", payload);
        const { name } = payload;
        try {
          await this.targetClients.removeClient(name);
          await this.sessions.shutdown();
          this.logger.info(`Target server ${name} removed successfully`);
          this.send({
            name: MCPXToWebserverMessage.TargetServerRemoved,
            payload: { name },
          });
        } catch (e: unknown) {
          if (e instanceof NotFoundError) {
            // res.status(404).send({ msg: `Target server ${name} not found` });
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
