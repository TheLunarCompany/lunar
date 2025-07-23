import {
  ApplyParsedAppConfigRequest,
  SerializedAppConfig,
  SystemState,
  TargetServerRequest,
  updateTargetServerRequestSchema,
} from "@mcpx/shared-model";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import { stringify } from "yaml";
import { z } from "zod/v4";
import {
  ConfigManager,
  ConfigSnapshot,
  dropDiscriminatingTags,
  parseVersionedConfig,
} from "../config.js";
import { convertToCurrentVersionConfig } from "./config-versioning.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { TargetServer } from "../model/target-servers.js";
import { SessionsManager } from "./sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { TargetClients } from "./target-clients.js";
import { env } from "../env.js";

export class ControlPlaneService {
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
    this.systemState = metricRecorder;
    this.targetClients = targetClients;
    this.sessions = sessions;
    this.configManager = configManager;
    this.logger = logger.child({ component: "ControlPlaneService" });
  }

  subscribeToAppConfigUpdates(
    callback: (state: ConfigSnapshot) => void,
  ): () => void {
    this.logger.info("Subscribing to app config updates");
    return this.configManager.subscribe(callback);
  }

  subscribeToSystemStateUpdates(
    callback: (state: SystemState) => void,
  ): () => void {
    this.logger.info("Subscribing to system state updates");
    return this.systemState.subscribe(callback);
  }

  getSystemState(): SystemState {
    this.logger.info("Received GetSystemState event from Control Plane");
    return this.systemState.export();
  }

  getAppConfig(): SerializedAppConfig {
    this.logger.info("Received GetAppConfig event from Control Plane", {});

    const metadata = {
      version: this.configManager.getVersion(),
      lastModified: this.configManager.getLastModified(),
    };
    const nextVersionConfig = this.configManager.getConfig();
    if (env.CONTROL_PLANE_APP_CONFIG_USE_NEXT_VERSION) {
      let yaml: string;
      if (env.CONTROL_PLANE_APP_CONFIG_KEEP_DISCRIMINATING_TAGS) {
        yaml = stringify(nextVersionConfig);
      } else {
        yaml = stringify(dropDiscriminatingTags(nextVersionConfig));
      }
      return { ...metadata, yaml };
    }

    return {
      ...metadata,
      yaml: stringify(convertToCurrentVersionConfig(nextVersionConfig)),
    };
  }

  async patchAppConfig(
    payload: ApplyParsedAppConfigRequest,
  ): Promise<SerializedAppConfig> {
    const parsedConfig = parseVersionedConfig(payload);
    if (!parsedConfig.success) {
      this.logger.error("Invalid config schema in PatchAppConfig request", {
        payload,
        error: parsedConfig.error,
      });
      throw parsedConfig.error;
    }

    const updated = this.configManager.updateConfig(parsedConfig.data);
    const updatedAppConfig: SerializedAppConfig = {
      yaml: stringify(this.configManager.getConfig()),
      version: this.configManager.getVersion(),
      lastModified: this.configManager.getLastModified(),
    };
    if (!updated) {
      this.logger.info("No changes in app config, skipping update", {
        updatedAppConfig,
      });
      return updatedAppConfig;
    }
    // Reload target clients to apply new config
    await this.targetClients.reloadClients();
    // Shutdown sessions so they can learn about new config
    await this.sessions.shutdown();
    this.logger.info("App config updated successfully", {
      updatedAppConfig,
    });
    return updatedAppConfig;
  }

  async addTargetServer(
    payload: TargetServerRequest,
  ): Promise<TargetServer | undefined> {
    this.logger.info("Received AddTargetServer event from Control Plane", {
      data: payload,
    });

    try {
      await this.targetClients.addClient(payload);
      await this.sessions.shutdown();
      this.logger.info(`Target server ${payload.name} created successfully`);
      return this.targetClients.getTargetServer(payload.name);
    } catch (e: unknown) {
      const error = loggableError(e);
      this.logger.error(`Failed to create target server ${payload.name}`, {
        error,
        data: payload,
      });
      if (
        e instanceof NotFoundError ||
        e instanceof AlreadyExistsError ||
        e instanceof FailedToConnectToTargetServer
      ) {
        throw e;
      }
      throw new Error(`Failed to create target server: ${error.errorMessage}`);
    }
  }

  // TODO: make sure failed update does not leave the system in an inconsistent state
  async updateTargetServer(
    name: string,
    payload: z.infer<typeof updateTargetServerRequestSchema>,
  ): Promise<TargetServer | undefined> {
    this.logger.info("Received UpdateTargetServer event from Control Plane");
    const existingTargetServer = this.targetClients.getTargetServer(name);

    if (!existingTargetServer) {
      this.logger.error(`Target server ${name} not found for update`, {
        data: payload,
      });
      throw new NotFoundError();
    }

    this.logger.info(`Updating target server ${name}`, {
      existingTargetServer,
      payload,
    });

    try {
      // TODO: replace with safe-swap technique:
      // Add new client with temp name, if successful, remove old client and rename new one
      // as non-failable operation
      await this.targetClients.removeClient(name);
      await this.targetClients.addClient({ ...payload, name });
      await this.sessions.shutdown();
      this.logger.info(`Target server ${name} updated successfully`);
      return this.targetClients.getTargetServer(name);
    } catch (e: unknown) {
      this.logger.error(`Failed to update target server ${name}`, {
        error: e,
        data: payload,
      });
      throw e;
    }
  }

  async removeTargetServer(name: string): Promise<void> {
    this.logger.info(
      "Received RemoveTargetServer event from Control Plane",
      name,
    );
    await this.targetClients.removeClient(name);
    await this.sessions.shutdown();
    this.logger.info(`Target server ${name} removed successfully`);
  }
}
