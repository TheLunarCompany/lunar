import { EventEmitter } from "events";
import { indexBy, makeError, stringifyEq } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import {
  McpxBoundPayloads,
  targetServerSchema,
  WebappBoundPayloadOf,
} from "@mcpx/webapp-protocol/messages";
import { Logger } from "winston";
import z from "zod/v4";
import { ConfigService } from "../config.js";
import { Config } from "../model/config/config.js";
import { ServiceToolGroup } from "../model/config/permissions.js";
import { TargetServer } from "../model/target-servers.js";
import { UpstreamHandler } from "./upstream-handler.js";

type ApplySetupPayload = z.infer<typeof McpxBoundPayloads.applySetup>;
type SetupConfigPayload = ApplySetupPayload["config"];

export type CurrentSetup = Omit<WebappBoundPayloadOf<"setup-change">, "source">;

export interface SetupManagerI {
  applySetup(
    payload: ApplySetupPayload,
  ): Promise<WebappBoundPayloadOf<"setup-change">>;
  isDigesting(): boolean;
  getCurrentSetup(): CurrentSetup;
  buildUserConfigChangePayload(
    config: Config,
  ): WebappBoundPayloadOf<"setup-change"> | null;
  buildUserTargetServersChangePayload(
    servers: TargetServer[],
  ): WebappBoundPayloadOf<"setup-change"> | null;
}

export class SetupManager implements SetupManagerI {
  private logger: Logger;
  private _isDigesting = false;
  private digestCompleteEmitter = new EventEmitter<{ complete: [] }>();
  private currentSetup: CurrentSetup;

  constructor(
    private upstreamHandler: UpstreamHandler,
    private configService: ConfigService,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "SetupManager" });
    this.currentSetup = {
      targetServers: {},
      config: this.getDefaultConfig(),
    };
  }

  isDigesting(): boolean {
    return this._isDigesting;
  }

  getCurrentSetup(): CurrentSetup {
    return this.currentSetup;
  }

  // Hook to run when user-initiated target-servers change occurs
  buildUserTargetServersChangePayload(
    servers: TargetServer[],
  ): WebappBoundPayloadOf<"setup-change"> | null {
    // Build new setup payload
    const targetServerRecord = indexBy(servers, (ts) => ts.name);

    // Check if changed
    if (stringifyEq(this.currentSetup.targetServers, targetServerRecord)) {
      return null;
    }

    // Update state
    this.currentSetup = {
      targetServers: targetServerRecord,
      config: this.currentSetup.config,
    };

    return {
      source: "user",
      ...this.currentSetup,
    };
  }

  buildUserConfigChangePayload(
    config: Config,
  ): WebappBoundPayloadOf<"setup-change"> | null {
    // Convert config to protocol format
    const normalizedConfig = this.normalizeConfig(config);

    // Check if changed
    if (stringifyEq(this.currentSetup.config, normalizedConfig)) {
      return null;
    }

    // Update state
    this.currentSetup = {
      targetServers: this.currentSetup.targetServers,
      config: normalizedConfig,
    };

    return {
      source: "user",
      ...this.currentSetup,
    };
  }

  async applySetup(
    payload: ApplySetupPayload,
  ): Promise<WebappBoundPayloadOf<"setup-change">> {
    this.logger.info("Applying setup from Hub", {
      source: payload.source,
      setupId: payload.setupId,
    });

    // Wait for any ongoing digest to complete
    if (this._isDigesting) {
      this.logger.info("Waiting for ongoing digest to complete...");
      await new Promise<void>((resolve) =>
        this.digestCompleteEmitter.once("complete", resolve),
      );
    }

    // Enter digest mode
    this._isDigesting = true;

    // Anchor current state (to be restored in case of failure)
    const currentTargetServers = indexBy(
      this.upstreamHandler.servers,
      (ts) => ts.name,
    );
    const currentConfig = this.normalizeConfig(this.configService.getConfig());

    try {
      await this.applyTargetServers(payload.targetServers);
      await this.applyConfig(payload.config);

      this.logger.info("Successfully applied setup", {
        source: payload.source,
        setupId: payload.setupId,
      });

      // Exit digest mode and build consolidated payload
      this._isDigesting = false;
      this.digestCompleteEmitter.emit("complete");
      return this.buildDigestedSetupPayload();
    } catch (e) {
      this.logger.error("Failed to apply setup", {
        source: payload.source,
        setupId: payload.setupId,
        error: loggableError(e),
      });
      await this.rollbackSetup(currentTargetServers, currentConfig);
      // Clean up digest state on failure
      this._isDigesting = false;
      this.digestCompleteEmitter.emit("complete");
      throw e;
    }
  }

  async resetSetup(): Promise<WebappBoundPayloadOf<"setup-change">> {
    this.logger.info("Resetting setup to clean state");
    return this.applySetup({
      source: "user",
      setupId: "reset",
      targetServers: {},
      config: this.getDefaultConfig(),
    });
  }

  // Rollback philosophy is that we try to restore previous state as best as we can,
  // but if we fail to restore either target-servers or config, we log the error and move on.
  // We do not attempt to retry restoration or fail the entire process, as that could lead to
  // infinite loops or other complications. The goal is to be resilient and maintain service availability,
  // even if the exact previous state cannot be fully restored.
  private async rollbackSetup(
    targetServers: Record<string, z.infer<typeof targetServerSchema>>,
    config: SetupConfigPayload,
  ): Promise<void> {
    // Attempt to restore previous state
    try {
      this.logger.info("Restoring previous target servers", {
        count: Object.keys(targetServers).length,
      });
      await this.applyTargetServers(targetServers);
    } catch (restoreError) {
      this.logger.error(
        "Failed to restore target servers after setup failure",
        {
          error: loggableError(restoreError),
        },
      );
    }

    try {
      this.logger.info("Restoring previous config");
      await this.applyConfig(config);
    } catch (restoreError) {
      this.logger.error("Failed to restore config after setup failure", {
        error: loggableError(restoreError),
      });
    }
    // Update currentSetup to reflect actual state after restoration attempt
    this.currentSetup = {
      targetServers: indexBy(this.upstreamHandler.servers, (ts) => ts.name),
      config: this.normalizeConfig(this.configService.getConfig()),
    };
  }

  private buildDigestedSetupPayload(): WebappBoundPayloadOf<"setup-change"> {
    this.logger.info("Building digested setup payload");

    // Get current state (reflects actual applied state)
    const currentTargetServers = indexBy(
      this.upstreamHandler.servers,
      (ts) => ts.name,
    );
    const currentConfig = this.normalizeConfig(this.configService.getConfig());

    // Update state
    this.currentSetup = {
      targetServers: currentTargetServers,
      config: currentConfig,
    };

    // Return payload with source="hub" (Hub-initiated change)
    return {
      source: "hub",
      ...this.currentSetup,
    };
  }

  private async applyTargetServers(
    targetServersPayload: Record<string, z.infer<typeof targetServerSchema>>,
  ): Promise<void> {
    // Convert payload to TargetServer[]
    const incomingServers: TargetServer[] = Object.entries(
      targetServersPayload,
    ).map(([name, config]) => ({ name, ...config }));

    this.logger.info("Applying target servers", {
      count: incomingServers.length,
    });

    // Get current server names
    const currentServerNames = Array.from(
      this.upstreamHandler.clientsByService.keys(),
    );

    // Remove all current servers
    this.logger.debug("Removing current target servers", {
      count: currentServerNames.length,
    });
    await Promise.all(
      currentServerNames.map((name) => this.upstreamHandler.removeClient(name)),
    );

    // Add all incoming servers
    this.logger.debug("Adding incoming target servers", {
      count: incomingServers.length,
    });
    const results = await Promise.allSettled(
      incomingServers.map((server) => this.upstreamHandler.addClient(server)),
    );

    const failures = results
      .map((r, i) => ({ result: r, server: incomingServers[i] }))
      .filter(
        (i): i is { result: PromiseRejectedResult; server: TargetServer } =>
          i.result.status === "rejected",
      );

    if (failures.length > 0) {
      const failureDetails = failures.map(({ server, result }) => ({
        name: server.name,
        reason: makeError(result.reason).message,
      }));
      this.logger.error("Failed to add some target servers", {
        failures: failureDetails,
        failureCount: failures.length,
        totalCount: incomingServers.length,
      });
    }

    this.logger.info("Target servers applied successfully");
  }

  private async applyConfig(incomingConfig: SetupConfigPayload): Promise<void> {
    this.logger.info("Applying config");
    await this.configService.withLock(async () => {
      await this.configService.updateConfig(fillInConfig(incomingConfig));
    });
    this.logger.info("Config applied successfully");
  }

  private normalizeConfig(config: Config): SetupConfigPayload {
    // Filter out ephemeral groups (e.g., dynamic-capabilities) - they shouldn't be synced to hub
    const userToolGroups = config.toolGroups?.filter(
      (g) => g.owner === undefined || g.owner === "user",
    );
    // Only include name and services in wire format (owner is local-only at the moment)
    const normalizedToolGroups = userToolGroups?.map((toolGroup) => ({
      name: toolGroup.name,
      services: Object.fromEntries(
        Object.entries(toolGroup.services).map(([serviceName, markedTools]) => [
          serviceName,
          this.normalizeMarkedTools(serviceName, markedTools),
        ]),
      ),
    }));

    return {
      ...config,
      toolGroups: normalizedToolGroups,
    };
  }

  private normalizeMarkedTools(
    serviceName: string,
    markedTools: ServiceToolGroup,
  ): string[] {
    if (markedTools === "*") {
      this.logger.warn(
        "'*' found as marked tools, expansion will be implemented later, returning empty list for now",
        { serviceName },
      );
      return [];
    }
    return markedTools;
  }

  private getDefaultConfig(): NonNullable<SetupConfigPayload> {
    return {
      toolGroups: [],
      toolExtensions: { services: {} },
      staticOauth: undefined,
      permissions: { default: { block: [] }, consumers: {} },
      auth: { enabled: false },
      targetServerAttributes: {},
    };
  }
}

function fillInConfig(partialConfig: SetupConfigPayload): Config {
  return {
    toolGroups: partialConfig.toolGroups ?? [],
    toolExtensions: partialConfig.toolExtensions ?? { services: {} },
    staticOauth: partialConfig.staticOauth,
    permissions: partialConfig.permissions ?? {
      default: { block: [] },
      consumers: {},
    },
    auth: partialConfig.auth ?? { enabled: false },
    targetServerAttributes: partialConfig.targetServerAttributes ?? {},
  };
}
