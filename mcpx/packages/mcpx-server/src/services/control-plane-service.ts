import {
  appConfigSchema,
  ApplyParsedAppConfigRequest,
  SerializedAppConfig,
  SystemState,
  TargetServerRequest,
} from "@mcpx/shared-model";
import { loggableError, LunarLogger } from "@mcpx/toolkit-core/logging";
import { stringify } from "yaml";
import { ConfigService, ConfigSnapshot } from "../config.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotAllowedError,
  NotFoundError,
  STDIO_SERVERS_DISABLED_MESSAGE,
} from "../errors.js";
import { env } from "../env.js";
import { TargetServer } from "../model/target-servers.js";
import { AuditLogService } from "./audit-log/audit-log-service.js";
import { ControlPlaneConfigService } from "./control-plane-config-service.js";
import { redactEnv } from "./redact.js";
import { SystemStateTracker } from "./system-state.js";
import { UpstreamHandler } from "./upstream-handler.js";

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
  private upstreamHandler: UpstreamHandler;
  private configService: ConfigService; // Dependency in deprecation - use this.config
  private auditLog: AuditLogService;
  private logger: LunarLogger;
  public config: ControlPlaneConfigService;

  constructor(
    metricRecorder: SystemStateTracker,
    upstreamHandler: UpstreamHandler,
    configService: ConfigService,
    auditLog: AuditLogService,
    logger: LunarLogger,
  ) {
    this.systemState = metricRecorder;
    this.upstreamHandler = upstreamHandler;
    this.configService = configService;
    this.auditLog = auditLog;
    this.config = new ControlPlaneConfigService(configService, logger);
    this.logger = logger.child({ component: "ControlPlaneService" });
  }

  subscribeToAppConfigUpdates(
    callback: (state: ConfigSnapshot) => void,
  ): () => void {
    this.logger.debug("Subscribing to app config updates");
    return this.config.subscribe(callback);
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

  // In deprecation: read dedicated config resources instead (`.config...`)
  getAppConfig(): SerializedAppConfig {
    this.logger.debug("Received GetAppConfig event from Control Plane");

    return {
      version: this.config.getVersion(),
      lastModified: this.config.getLastModified(),
      yaml: stringify(this.config.getConfig()),
    };
  }

  // In deprecation: create/update/delete dedicated config resources instead (`.config...`)
  async patchAppConfig(
    payload: ApplyParsedAppConfigRequest,
  ): Promise<SerializedAppConfig> {
    const parsedConfig = appConfigSchema.safeParse(payload);
    if (!parsedConfig.success) {
      this.logger.error("Invalid config schema in PatchAppConfig request", {
        payload,
        error: parsedConfig.error,
      });
      throw parsedConfig.error;
    }

    return this.configService.withLock(async () => {
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
      // updateConfig fires configService subscribers; UpstreamHandler refreshes
      // affected clients when toolExtensions change. No reload needed here.
      return updatedAppConfig;
    });
  }

  async addTargetServer(
    payload: TargetServer,
  ): Promise<TargetServer | undefined> {
    if (payload.type === "stdio" && !env.ENABLE_STDIO_MCP_SERVERS) {
      throw new NotAllowedError(STDIO_SERVERS_DISABLED_MESSAGE);
    }
    // Do not include env vars in logs when adding server (any type)
    const data = redactEnv(payload);
    this.logger.info("Received AddTargetServer event from Control Plane", {
      data,
    });

    try {
      await this.upstreamHandler.addClient(payload);
      this.logger.info(`Target server ${payload.name} created successfully`);
      this.auditLog.log({
        eventType: "target_server_added",
        payload: { name: payload.name },
      });
      this.logger.telemetry.info("target server added", {
        mcpServers: {
          [payload.name]: sanitizeTargetServerForTelemetry(payload),
        },
      });
      return this.upstreamHandler.getTargetServer(payload.name);
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
    payload: TargetServer,
  ): Promise<TargetServer | undefined> {
    if (payload.type === "stdio" && !env.ENABLE_STDIO_MCP_SERVERS) {
      throw new NotAllowedError(STDIO_SERVERS_DISABLED_MESSAGE);
    }
    this.logger.info("Received UpdateTargetServer event from Control Plane");
    const existingTargetServer = this.upstreamHandler.getTargetServer(
      payload.name,
    );

    // Prepare sanitized copies for logging (remove env from any type)
    const cleanPayload = redactEnv(payload);
    const cleanExisting = existingTargetServer
      ? redactEnv(existingTargetServer)
      : undefined;

    if (!existingTargetServer) {
      this.logger.error(`Target server ${payload.name} not found for update`, {
        data: cleanPayload,
      });
      throw new NotFoundError();
    }

    this.logger.info(`Updating target server ${payload.name}`, {
      existingTargetServer: cleanExisting,
      payload: cleanPayload,
    });

    try {
      // TODO: replace with safe-swap technique:
      // Add new client with temp name, if successful, remove old client and rename new one
      // as non-failable operation
      await this.upstreamHandler.removeClient(payload.name);
      await this.upstreamHandler.addClient({
        ...existingTargetServer,
        ...payload,
      }); // use the existingTargetServer catalogItemId if it's in the existing target server
      this.logger.info(`Target server ${payload.name} updated successfully`);
      this.logger.telemetry.info("target server updated", {
        mcpServers: {
          [payload.name]: sanitizeTargetServerForTelemetry({ ...payload }),
        },
      });
      return this.upstreamHandler.getTargetServer(payload.name);
    } catch (e: unknown) {
      this.logger.error(`Failed to update target server ${payload.name}`, {
        error: e,
        data: cleanPayload,
      });
      throw e;
    }
  }

  async removeTargetServer(name: string): Promise<void> {
    this.logger.info("Received RemoveTargetServer event from Control Plane", {
      name,
    });
    await this.upstreamHandler.removeClient(name);
    this.auditLog.log({
      eventType: "target_server_removed",
      payload: { name },
    });
    await this.config.removeTargetServerAttribute(name).catch((e) => {
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
}
