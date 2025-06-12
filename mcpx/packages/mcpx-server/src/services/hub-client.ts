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
import { logger } from "../logger.js";
import { configSchema } from "../model.js";
import { loggableError } from "../utils/logging.js";
import { MetricRecorder } from "./metric-recorder.js";
import { SessionsManager } from "./sessions.js";
import { TargetClients } from "./target-clients.js";

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
  metricRecorder: MetricRecorder,
  targetClients: TargetClients,
  sessions: SessionsManager,
  configManager: ConfigManager,
): HubClientI {
  if (env.ENABLE_HUB) {
    return new HubClient(
      metricRecorder,
      targetClients,
      sessions,
      configManager,
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
  private metricRecorder: MetricRecorder;
  private targetClients: TargetClients;
  private sessions: SessionsManager;
  private configManager: ConfigManager;

  constructor(
    metricRecorder: MetricRecorder,
    targetClients: TargetClients,
    sessions: SessionsManager,
    configManager: ConfigManager,
  ) {
    this.socket = io(env.HUB_HOST, { path: "/ws-mcpx-hub" });

    this.metricRecorder = metricRecorder;
    this.targetClients = targetClients;
    this.sessions = sessions;
    this.configManager = configManager;

    this.setupEventHandlers();
  }

  shutdown(): void {
    logger.info("Shutting down HubClient...");
    this.socket.close();
  }

  private send(message: Message | ErrorMessage): void {
    logger.info(`Sending message to hub: ${message.name}`, {
      payload: message.payload,
    });
    this.socket.emit(message.name, message.payload);
  }

  private setupEventHandlers(): void {
    this.metricRecorder.subscribe((payload) => {
      this.send({ name: MCPXToWebserverMessage.SystemState, payload });
    });

    this.socket.on("connect", () => {
      logger.info("Connected to hub");
      const payload = this.metricRecorder.export();
      this.send({ name: MCPXToWebserverMessage.SystemState, payload });
    });

    this.socket.on(WebserverToMCPXMessage.GetSystemState, () => {
      logger.info("Received GetSystemState event from hub");
      const payload = this.metricRecorder.export();
      this.send({ name: MCPXToWebserverMessage.SystemState, payload });
    });

    this.socket.on(WebserverToMCPXMessage.GetAppConfig, () => {
      logger.info("Received GetAppConfig event from hub");
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
        logger.info("Received PatchAppConfig event from hub");

        // `payload.obj` is expected to be a valid object, parsed from raw YAML,
        // however, webserver does not validate it according to config schema
        const parsedConfig = configSchema.safeParse(payload.obj);
        if (!parsedConfig.success) {
          logger.error("Invalid config schema in PatchAppConfig request", {
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
        logger.info("App config updated successfully", {
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
        logger.info("Received AddTargetServer event from hub");
        try {
          await this.targetClients.addClient(data);
          await this.sessions.shutdown();
          logger.info(`Target server ${data.name} created successfully`);
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
          logger.error("Error creating target server", {
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
        logger.info("Received UpdateTargetServer event from hub");
        const existingTargetServer = this.targetClients.getTargetServer(
          data.name,
        );

        if (!existingTargetServer) {
          logger.error(`Target server ${data.name} not found for update`, {
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
          logger.info(`Target server ${data.name} updated successfully`);
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
            logger.error(`Target server ${data.name} not found`, { data });
            this.send({
              name: MCPXToWebserverMessage.UpdateTargetServerFailed,
              payload: { failure: ManageTargetServerFailure.NotFound },
            });
            return;
          }
          const error = loggableError(e);
          logger.error("Error updating target server", { error, data });
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
        logger.info("Received RemoveTargetServer event from hub", payload);
        const { name } = payload;
        try {
          await this.targetClients.removeClient(name);
          await this.sessions.shutdown();
          logger.info(`Target server ${name} removed successfully`);
          this.send({
            name: MCPXToWebserverMessage.TargetServerRemoved,
            payload: { name },
          });
        } catch (e: unknown) {
          if (e instanceof NotFoundError) {
            // res.status(404).send({ msg: `Target server ${name} not found` });
            logger.error(`Target server ${name} not found`, { name });
            this.send({
              name: MCPXToWebserverMessage.RemoveTargetServerFailed,
              payload: { failure: ManageTargetServerFailure.NotFound },
            });
            return;
          }
          const error = loggableError(e);
          logger.error("Error removing target server", { error, name });
          this.send({
            name: MCPXToWebserverMessage.RemoveTargetServerFailed,
            payload: { failure: ManageTargetServerFailure.InternalServerError },
          });
        }
      },
    );
  }
}
