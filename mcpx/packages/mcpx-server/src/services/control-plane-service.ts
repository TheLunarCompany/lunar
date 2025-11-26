import {
  ApplyParsedAppConfigRequest,
  SerializedAppConfig,
  SystemState,
  TargetServerRequest,
} from "@mcpx/shared-model";
import { loggableError, LunarLogger } from "@mcpx/toolkit-core/logging";
import { stringifyEq } from "@mcpx/toolkit-core/data";
import { stringify } from "yaml";
import { z } from "zod/v4";
import {
  ConfigService,
  ConfigSnapshot,
  dropDiscriminatingTags,
  parseVersionedConfig,
} from "../config.js";
import { env } from "../env.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { TargetServerAttributes } from "../model/config/config.js";
import { TargetServer, targetServerSchema } from "../model/target-servers.js";
import { convertToCurrentVersionConfig } from "./config-versioning.js";
import { SystemStateTracker } from "./system-state.js";
import { TargetClients } from "./target-clients.js";

export function sanitizeTargetServerForTelemetry(
  server: TargetServerRequest | TargetServer,
): Record<string, unknown> {
  switch (server.type) {
    case "stdio":
      return {
        name: server.name,
        type: server.type,
        command: server.command,
        args: server.args,
      };
    case "sse":
    case "streamable-http":
      return server;
  }
}

export class ControlPlaneService {
  private systemState: SystemStateTracker;
  private targetClients: TargetClients;
  private configService: ConfigService;
  private logger: LunarLogger;

  constructor(
    metricRecorder: SystemStateTracker,
    targetClients: TargetClients,
    configService: ConfigService,
    logger: LunarLogger,
  ) {
    this.systemState = metricRecorder;
    this.targetClients = targetClients;
    this.configService = configService;
    this.logger = logger.child({ component: "ControlPlaneService" });
  }

  subscribeToAppConfigUpdates(
    callback: (state: ConfigSnapshot) => void,
  ): () => void {
    this.logger.debug("Subscribing to app config updates");
    return this.configService.subscribe(callback);
  }

  subscribeToSystemStateUpdates(
    callback: (state: SystemState) => void,
  ): () => void {
    this.logger.debug("Subscribing to system state updates");
    return this.systemState.subscribe(callback);
  }

  getSystemState(): SystemState {
    this.logger.debug("Received GetSystemState event from Control Plane");
    return this.systemState.export();
  }

  getAppConfig(): SerializedAppConfig {
    this.logger.debug("Received GetAppConfig event from Control Plane");

    const metadata = {
      version: this.configService.getVersion(),
      lastModified: this.configService.getLastModified(),
    };
    const nextVersionConfig = this.configService.getConfig();
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

    // Get current config before update to compare
    const currentConfig = this.configService.getConfig();
    const updated = await this.configService.updateConfig(parsedConfig.data);
    const updatedAppConfig: SerializedAppConfig = {
      yaml: stringify(this.configService.getConfig()),
      version: this.configService.getVersion(),
      lastModified: this.configService.getLastModified(),
    };
    if (!updated) {
      this.logger.info("No changes in app config, skipping update", {
        updatedAppConfig,
      });
      return updatedAppConfig;
    }

    // Only reload clients if server-related config changed
    // toolExtensions is the only config field that affects server connections
    const newConfig = this.configService.getConfig();
    const serverConfigChanged = !stringifyEq(
      currentConfig.toolExtensions,
      newConfig.toolExtensions,
    );

    if (serverConfigChanged) {
      this.logger.info(
        "Server-related config (toolExtensions) changed, reloading target clients",
      );
      await this.targetClients.reloadClients();
    } else {
      this.logger.info(
        "Only non-server config changed (permissions/toolGroups/auth/targetServerAttributes), skipping client reload",
      );
    }
    return updatedAppConfig;
  }

  async addTargetServer(
    payload: TargetServerRequest,
  ): Promise<TargetServer | undefined> {
    // Do not include env vars in logs when adding server (any type)
    const data: Record<string, unknown> = {
      ...(payload as unknown as Record<string, unknown>),
    };
    if ("env" in data) {
      delete (data as { env?: unknown }).env;
    }
    this.logger.info("Received AddTargetServer event from Control Plane", {
      data,
    });

    try {
      await this.targetClients.addClient(payload);
      this.logger.info(`Target server ${payload.name} created successfully`);
      this.logger.telemetry.info("target server added", {
        mcpServers: {
          [payload.name]: sanitizeTargetServerForTelemetry(payload),
        },
      });
      return this.targetClients.getTargetServer(payload.name);
    } catch (e: unknown) {
      const error = loggableError(e);
      this.logger.error(`Failed to create target server ${payload.name}`, {
        error,
        data: data,
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
    payload: z.infer<typeof targetServerSchema>,
  ): Promise<TargetServer | undefined> {
    this.logger.info("Received UpdateTargetServer event from Control Plane");
    const existingTargetServer = this.targetClients.getTargetServer(name);

    // Prepare sanitized copies for logging (remove env from any type)
    const cleanPayload: Record<string, unknown> = {
      ...(payload as unknown as Record<string, unknown>),
    };
    if ("env" in cleanPayload) {
      delete (cleanPayload as { env?: unknown }).env;
    }
    const cleanExisting: Record<string, unknown> | undefined =
      existingTargetServer
        ? ({
            ...(existingTargetServer as unknown as Record<string, unknown>),
          } as Record<string, unknown>)
        : undefined;
    if (cleanExisting && "env" in cleanExisting) {
      delete (cleanExisting as { env?: unknown }).env;
    }

    if (!existingTargetServer) {
      this.logger.error(`Target server ${name} not found for update`, {
        data: cleanPayload,
      });
      throw new NotFoundError();
    }

    this.logger.info(`Updating target server ${name}`, {
      existingTargetServer: cleanExisting,
      payload: cleanPayload,
    });

    try {
      // TODO: replace with safe-swap technique:
      // Add new client with temp name, if successful, remove old client and rename new one
      // as non-failable operation
      await this.targetClients.removeClient(name);
      await this.targetClients.addClient({ ...payload, name });
      this.logger.info(`Target server ${name} updated successfully`);
      this.logger.telemetry.info("target server updated", {
        mcpServers: {
          [name]: sanitizeTargetServerForTelemetry({ ...payload, name }),
        },
      });
      return this.targetClients.getTargetServer(name);
    } catch (e: unknown) {
      this.logger.error(`Failed to update target server ${name}`, {
        error: e,
        data: cleanPayload,
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
    await this.removeTargetServerFromAttributes(name).catch((e) => {
      this.logger.warn(
        `Failed to remove target server ${name} from config's attributes during removal`,
        { error: loggableError(e) },
      );
    });
    this.logger.info(`Target server ${name} removed successfully`);
    this.logger.telemetry.info("target server removed", {
      mcpServers: { [name]: null },
    });
  }

  async removeTargetServerFromAttributes(name: string): Promise<void> {
    this.logger.info(
      "Received RemoveTargetServerFromAttributes event from Control Plane",
      name,
    );

    const currentConfig = this.configService.getConfig();
    const { [name]: _, ...updatedAttributes } =
      currentConfig.targetServerAttributes;
    const updatedConfig = {
      ...currentConfig,
      targetServerAttributes: updatedAttributes,
    };

    await this.configService.updateConfig(updatedConfig);
    this.logger.info(
      `Target server ${name} removed from attributes successfully`,
    );
  }

  async activateTargetServer(name: string): Promise<void> {
    const normalizedName = name.trim().toLowerCase();
    this.logger.info("Received ActivateTargetServer event from Control Plane", {
      normalizedName,
    });

    const currentConfig = this.configService.getConfig();
    const currentAttributes =
      currentConfig.targetServerAttributes[normalizedName];

    const updatedAttributes = currentAttributes
      ? { ...currentAttributes, inactive: false }
      : { inactive: false };

    const updatedConfig = {
      ...currentConfig,
      targetServerAttributes: {
        ...currentConfig.targetServerAttributes,
        [normalizedName]: updatedAttributes,
      },
    };

    await this.configService.updateConfig(updatedConfig);
    this.logger.info(`Target server ${name} activated successfully`);
  }

  async deactivateTargetServer(name: string): Promise<void> {
    const normalizedName = name.trim().toLowerCase();
    this.logger.info(
      "Received DeactivateTargetServer event from Control Plane",
      { normalizedName },
    );

    const currentConfig = this.configService.getConfig();
    const currentAttributes =
      currentConfig.targetServerAttributes[normalizedName];

    const updatedAttributes = currentAttributes
      ? { ...currentAttributes, inactive: true }
      : { inactive: true };

    const updatedConfig = {
      ...currentConfig,
      targetServerAttributes: {
        ...currentConfig.targetServerAttributes,
        [normalizedName]: updatedAttributes,
      },
    };

    await this.configService.updateConfig(updatedConfig);
    this.logger.info(`Target server ${name} deactivated successfully`);
  }

  getTargetServerAttributes(): Record<string, TargetServerAttributes> {
    this.logger.info(
      "Received GetTargetServerAttributes event from Control Plane",
    );

    const currentConfig = this.configService.getConfig();
    const snapshot = currentConfig.targetServerAttributes;

    this.logger.info("Target server attributes retrieved successfully", {
      snapshot,
    });

    return snapshot;
  }
}
