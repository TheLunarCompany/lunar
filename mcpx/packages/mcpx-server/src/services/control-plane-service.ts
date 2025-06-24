import { Logger } from "winston";
import { ConfigManager } from "../config.js";
import { SessionsManager } from "./sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { TargetClients } from "./target-clients.js";
import {
  ApplyParsedAppConfigRequest,
  SerializedAppConfig,
  SystemState,
  TargetServerRequest,
} from "@mcpx/shared-model";
import { stringify } from "yaml";
import { configSchema } from "../model.js";
import { NotFoundError } from "../errors.js";

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
    this.logger = logger.child({ component: "HubClient" });
  }

  getSystemState(): SystemState {
    this.logger.info("Received GetSystemState event from hub");
    return this.systemState.export();
  }

  getAppConfig(): SerializedAppConfig {
    this.logger.info("Received GetAppConfig event from hub");
    return {
      yaml: stringify(this.configManager.getConfig()),
      version: this.configManager.getVersion(),
      lastModified: this.configManager.getLastModified(),
    };
  }

  patchAppConfig(payload: ApplyParsedAppConfigRequest): SerializedAppConfig {
    // `payload.obj` is expected to be a valid object, parsed from raw YAML,
    // however, webserver does not validate it according to config schema
    const parsedConfig = configSchema.safeParse(payload.obj);
    if (!parsedConfig.success) {
      this.logger.error("Invalid config schema in PatchAppConfig request", {
        payload,
        error: parsedConfig.error,
      });
      throw parsedConfig.error;
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
    return updatedAppConfig;
  }

  async addTargetServer(payload: TargetServerRequest): Promise<void> {
    this.logger.info("Received AddTargetServer event from hub", {
      data: payload,
    });
    // This is confusing, we are handling target server creation
    // but the underlying method is called `targetClients.addClient()`.
    // TODO: Consider renaming for clarity.
    await this.targetClients.addClient(payload);
    await this.sessions.shutdown();
    this.logger.info(`Target server ${payload.name} created successfully`);
    return;
  }

  // TODO: make sure failed update does not leave the system in an inconsistent state
  async updateTargetServer(
    name: string,
    payload: Omit<TargetServerRequest, "name">,
  ): Promise<void> {
    this.logger.info("Received UpdateTargetServer event from hub");
    const existingTargetServer = this.targetClients.getTargetServer(name);

    if (!existingTargetServer) {
      this.logger.error(`Target server ${name} not found for update`, {
        data: payload,
      });
      throw new NotFoundError();
    }

    // TODO: replace with safe-swap technique:
    // Add new client with temp name, if successful, remove old client and rename new one
    // as non-failable operation
    await this.targetClients.removeClient(name);
    await this.targetClients.addClient({ ...payload, name });
    await this.sessions.shutdown();
    this.logger.info(`Target server ${name} updated successfully`);
    return;
  }

  async removeTargetServer(name: string): Promise<void> {
    this.logger.info("Received RemoveTargetServer event from hub", name);
    await this.targetClients.removeClient(name);
    await this.sessions.shutdown();
    this.logger.info(`Target server ${name} removed successfully`);
  }
}
