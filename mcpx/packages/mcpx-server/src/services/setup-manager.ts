import { EventEmitter } from "events";
import { makeError, stringifyEq } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import {
  McpxBoundPayloads,
  type TargetServerEntry,
  WebappBoundPayloadOf,
} from "@mcpx/webapp-protocol/messages";
import { Logger } from "winston";
import z from "zod/v4";
import { ConfigService } from "../config.js";
import { Config } from "../model/config/config.js";
import {
  ConsumerConfig,
  ServiceToolGroup,
} from "../model/config/permissions.js";
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

  private static targetServerToEntry(
    server: TargetServer,
  ): [string, TargetServerEntry] {
    const { name, catalogItemId, ...rest } = server;
    const initiation: TargetServerEntry["initiation"] = rest;
    return [name, { initiation, catalogItemId }];
  }

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
    // Build new setup payload in entry format
    const targetServerRecord: Record<string, TargetServerEntry> =
      Object.fromEntries(servers.map(SetupManager.targetServerToEntry));

    // Check if changed
    if (stringifyEq(this.currentSetup.targetServers, targetServerRecord)) {
      return null;
    }

    // Update state
    this.currentSetup = {
      targetServers: targetServerRecord,
      config: this.currentSetup.config,
    };

    const payload = {
      source: "user" as const,
      ...this.currentSetup,
    };
    return payload;
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
    const currentTargetServers = [...this.upstreamHandler.servers];
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
      return this.buildDigestedSetupPayload(payload.targetServers);
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
    const emptyTargetServers: Record<string, TargetServerEntry> = {};
    return this.applySetup({
      source: "user",
      setupId: "reset",
      targetServers: emptyTargetServers,
      config: this.getDefaultConfig(),
    });
  }

  // Rollback philosophy is that we try to restore previous state as best as we can,
  // but if we fail to restore either target-servers or config, we log the error and move on.
  // We do not attempt to retry restoration or fail the entire process, as that could lead to
  // infinite loops or other complications. The goal is to be resilient and maintain service availability,
  // even if the exact previous state cannot be fully restored.
  private async rollbackSetup(
    targetServers: TargetServer[],
    config: SetupConfigPayload,
  ): Promise<void> {
    // Convert TargetServer[] back to entry format for applyTargetServers
    const entries: Record<string, TargetServerEntry> = Object.fromEntries(
      targetServers.map(SetupManager.targetServerToEntry),
    );
    // Attempt to restore previous state
    try {
      this.logger.info("Restoring previous target servers", {
        count: targetServers.length,
      });
      await this.applyTargetServers(entries);
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
      targetServers: Object.fromEntries(
        this.upstreamHandler.servers.map(SetupManager.targetServerToEntry),
      ),
      config: this.normalizeConfig(this.configService.getConfig()),
    };
  }

  private buildDigestedSetupPayload(
    incomingTargetServers: Record<string, TargetServerEntry> = {},
  ): WebappBoundPayloadOf<"setup-change"> {
    this.logger.info("Building digested setup payload");

    // Get current state (reflects actual applied state), preserving catalogItemId
    const currentTargetServers: Record<string, TargetServerEntry> =
      Object.fromEntries(
        this.upstreamHandler.servers.map((server) => {
          const [name, entry] = SetupManager.targetServerToEntry(server);
          return [
            name,
            {
              ...entry,
              catalogItemId:
                entry.catalogItemId ??
                incomingTargetServers[name]?.catalogItemId,
            },
          ];
        }),
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
    targetServersPayload: Record<string, TargetServerEntry>,
  ): Promise<void> {
    // Convert payload to TargetServer[]
    const incomingServers: TargetServer[] = Object.entries(
      targetServersPayload,
    ).map(([name, { initiation, catalogItemId }]) => ({
      name,
      ...initiation,
      catalogItemId,
    }));

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
      throw new Error(
        `Failed to add ${failures.length}/${incomingServers.length} target servers: ${failureDetails.map((f) => f.name).join(", ")}`,
      );
    }

    this.logger.info("Target servers applied successfully");
  }

  private async applyConfig(incomingConfig: SetupConfigPayload): Promise<void> {
    this.logger.info("Applying config");
    await this.configService.withLock(async () => {
      await this.configService.updateConfig(
        sanitizeIncomingConfig(incomingConfig),
      );
    });
    this.logger.info("Config applied successfully");
  }

  private normalizeConfig(config: Config): SetupConfigPayload {
    // Filter out ephemeral groups (e.g., dynamic-capabilities) - they shouldn't be synced to hub
    const dynamicGroupNames = new Set(
      config.toolGroups
        ?.filter((g) => g.owner === "dynamic-capabilities")
        .map((g) => g.name) ?? [],
    );
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

    // Filter out consumer permissions that reference dynamic groups
    const consumers = config.permissions?.consumers ?? {};
    const filteredConsumers = Object.fromEntries(
      Object.entries(consumers).filter(
        ([, consumerConfig]) =>
          !consumerConfig.consumerGroupKey ||
          !dynamicGroupNames.has(consumerConfig.consumerGroupKey),
      ),
    );

    return {
      ...config,
      permissions: {
        ...config.permissions,
        consumers: filteredConsumers,
      },
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
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: {},
        clientNames: {},
      },
      auth: { enabled: false },
      targetServerAttributes: {},
    };
  }
}

/**
 * Fills in defaults and sanitizes incoming config from Hub.
 * Drops consumer configs that reference non-existent tool groups,
 * which can happen when ephemeral groups (like dynamic-capabilities) were
 * persisted to Hub before being filtered out.
 */
export function sanitizeIncomingConfig(
  partialConfig: SetupConfigPayload,
): Config {
  const config = fillInConfig(partialConfig);
  const sanitizedPermissions = dropPermissionsReferencingMissingToolGroups(
    config.permissions,
    new Set(config.toolGroups.map((tg) => tg.name)),
  );
  return {
    ...config,
    permissions: sanitizedPermissions,
  };
}

function dropPermissionsReferencingMissingToolGroups(
  permissions: Config["permissions"],
  existingGroupNames: Set<string>,
): Config["permissions"] {
  const filterStale = (
    entries: Record<string, ConsumerConfig>,
  ): Record<string, ConsumerConfig> =>
    Object.fromEntries(
      Object.entries(entries).filter(
        ([, config]) => !hasStaleGroupReferences(config, existingGroupNames),
      ),
    );
  return {
    default: hasStaleGroupReferences(permissions.default, existingGroupNames)
      ? { _type: "default-allow", block: [] }
      : permissions.default,
    consumers: filterStale(permissions.consumers),
    clientNames: filterStale(permissions.clientNames),
  };
}

// Fills in defaults for any missing config sections to ensure we always have a complete config object to work with internally
function fillInConfig(partialConfig: SetupConfigPayload): Config {
  return {
    toolGroups: partialConfig.toolGroups ?? [],
    toolExtensions: partialConfig.toolExtensions ?? { services: {} },
    staticOauth: partialConfig.staticOauth,
    permissions: partialConfig.permissions ?? {
      default: { _type: "default-allow", block: [] },
      consumers: {},
      clientNames: {},
    },
    auth: partialConfig.auth ?? { enabled: false },
    targetServerAttributes: partialConfig.targetServerAttributes ?? {},
  };
}

// Checks if the given consumer config references any tool groups that don't exist in the config.
// This helps config not to be rejected in case of some stale references.
// e.g. if a consumerConfig references a dynamic-capabilities group that was filtered out before, we just want to ignore the stale reference and treat it as if the consumer has no group (falls back to default permissions).
function hasStaleGroupReferences(
  config: ConsumerConfig,
  existingGroupNames: Set<string>,
): boolean {
  const groupNames = "allow" in config ? config.allow : config.block;
  return groupNames.some((name) => !existingGroupNames.has(name));
}
