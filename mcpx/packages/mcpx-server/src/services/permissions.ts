import { ConfigConsumer } from "@mcpx/toolkit-core/config";
import { Logger } from "winston";
import { Config } from "../model/config/config.js";
import type {
  ConsumerConfig,
  Permission,
  ServiceToolGroup,
} from "../model/config/permissions.js";

type ServiceLevelPermission =
  | { tag: "allow_all" }
  | { tag: "block_all" }
  | { tag: "allow"; value: Set<string> }
  | { tag: "block"; value: Set<string> };

interface ConsumerLevelPermission {
  default: Permission;
  services: Map<string, ServiceLevelPermission>;
}

class PermissionManagerState {
  consumers: Map<string, ConsumerLevelPermission> = new Map();
  defaultConsumer: ConsumerLevelPermission | null = null;
  toolGroupByName: Record<string, Record<string, ServiceToolGroup>> = {};
  private _initialized = false;

  get initialized(): boolean {
    return this._initialized;
  }

  initialize(config: Config): void {
    if (this._initialized) {
      throw new Error("PermissionManagerState is already initialized");
    }
    // Prepare toolGroups
    this.toolGroupByName = config.toolGroups.reduce<
      Record<string, Record<string, ServiceToolGroup>>
    >((acc, group) => {
      acc[group.name] = group.services;
      return acc;
    }, {});

    // Initialize default consumer
    this.defaultConsumer = this.buildConsumerPermissions(
      config.permissions.default,
    );

    // Initialize regular consumers
    Object.entries(config.permissions.consumers).forEach(([name, config]) =>
      this.consumers.set(name, this.buildConsumerPermissions(config)),
    );
    this._initialized = true;
  }

  private buildConsumerPermissions(
    config: ConsumerConfig,
  ): ConsumerLevelPermission {
    const services = new Map<string, ServiceLevelPermission>();

    let defaultPermission: Permission;

    // Determine the type based on available properties or _type field
    const hasAllow = "allow" in config && Array.isArray(config.allow);
    const hasBlock = "block" in config && Array.isArray(config.block);

    if (hasBlock && !hasAllow) {
      // Has block array but no allow array - default-allow behavior
      this.addServices(
        services,
        "block" in config && Array.isArray(config.block) ? config.block : [],
        "block",
      );
      defaultPermission = "allow";
    } else if (hasAllow && !hasBlock) {
      // Has allow array but no block array - default-block behavior
      this.addServices(
        services,
        "allow" in config && Array.isArray(config.allow) ? config.allow : [],
        "allow",
      );
      defaultPermission = "block";
    } else if (config._type === "default-allow") {
      // Explicit default-allow type
      this.addServices(
        services,
        "block" in config && Array.isArray(config.block) ? config.block : [],
        "block",
      );
      defaultPermission = "allow";
    } else {
      // Default to default-block behavior
      this.addServices(
        services,
        "allow" in config && Array.isArray(config.allow) ? config.allow : [],
        "allow",
      );
      defaultPermission = "block";
    }

    return { default: defaultPermission, services };
  }

  private addServices(
    services: Map<string, ServiceLevelPermission>,
    profileNames: string[],
    type: "allow" | "block",
  ): void {
    for (const profileName of profileNames) {
      const toolGroup = this.toolGroupByName[profileName];
      if (!toolGroup) {
        throw new Error(
          `Required ToolGroup ${profileName} not found, review config`,
        );
      }
      Object.entries(toolGroup).forEach(([serviceName, serviceToolGroup]) => {
        const current = services.get(serviceName);
        if (!current) {
          services.set(
            serviceName,
            buildServicePermissions(type, serviceToolGroup),
          );
        } else {
          services.set(
            serviceName,
            mergeServicePermissions(
              current,
              buildServicePermissions(type, serviceToolGroup),
            ),
          );
        }
      });
    }
  }
}

function buildServicePermissions(
  type: "allow" | "block",
  serviceToolGroup: ServiceToolGroup,
): ServiceLevelPermission {
  if (typeof serviceToolGroup === "string" && serviceToolGroup === "*") {
    if (type === "allow") {
      return { tag: "allow_all" };
    } else {
      return { tag: "block_all" };
    }
  } else {
    if (type === "allow") {
      return { tag: "allow", value: new Set(serviceToolGroup) };
    } else {
      return { tag: "block", value: new Set(serviceToolGroup) };
    }
  }
}

export class PermissionManager implements ConfigConsumer<Config> {
  readonly name = "PermissionManager";
  private currentState = new PermissionManagerState();
  private nextState: PermissionManagerState | null = null;

  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "PermissionManager" });
  }

  prepareConfig(newConfig: Config): Promise<void> {
    try {
      const nextState = new PermissionManagerState();
      nextState.initialize(newConfig);

      // Set next state
      this.nextState = nextState;
      return Promise.resolve();
    } catch (e: unknown) {
      return Promise.reject(e);
    }
  }

  async commitConfig(): Promise<void> {
    if (!this.nextState) {
      return Promise.reject(new Error("No next state to commit"));
    }
    this.currentState = this.nextState;
    this.nextState = null;
  }

  rollbackConfig(): void {
    this.logger.info("rolling back config");
    this.nextState = null;
  }

  hasPermission(props: {
    serviceName: string;
    toolName: string;
    consumerTag?: string;
  }): boolean {
    if (!this.currentState.initialized) {
      throw new Error("PermissionManager is not initialized");
    }

    const { consumerTag, serviceName, toolName } = props;

    const consumer = consumerTag
      ? this.currentState.consumers.get(consumerTag)
      : null;
    if (!consumer) {
      return this.getAnonymousConsumerPermission(serviceName, toolName);
    }

    const { default: consumerDefault, services } = consumer;
    const service = services.get(serviceName);
    if (!service) {
      return consumerDefault === "allow";
    }
    switch (service.tag) {
      case "allow_all":
        return true;
      case "block_all":
        return false;
      case "allow":
        return service.value.has(toolName);
      case "block":
        return !service.value.has(toolName);
    }
  }

  private getAnonymousConsumerPermission(
    serviceName: string,
    toolName: string,
  ): boolean {
    if (!this.currentState.defaultConsumer) {
      throw new Error("Anonymous consumer not initialized");
    }

    const service = this.currentState.defaultConsumer.services.get(serviceName);
    if (!service) {
      return this.currentState.defaultConsumer.default === "allow";
    }

    switch (service.tag) {
      case "allow_all":
        return true;
      case "block_all":
        return false;
      case "allow":
        return service.value.has(toolName);
      case "block":
        return !service.value.has(toolName);
    }
  }
}

function mergeServicePermissions(
  existing: ServiceLevelPermission,
  current: ServiceLevelPermission,
): ServiceLevelPermission {
  // If either is *_all, it takes precedence
  if (existing.tag === "allow_all" || current.tag === "allow_all") {
    return { tag: "allow_all" };
  }
  if (existing.tag === "block_all" || current.tag === "block_all") {
    return { tag: "block_all" };
  }

  // Otherwise merge the sets (they must be the same type)
  if (existing.tag === "allow" && current.tag === "allow") {
    return {
      tag: "allow",
      value: new Set([...existing.value, ...current.value]),
    };
  }

  // Must be both "block"
  return {
    tag: "block",
    value: new Set([...existing.value, ...current.value]),
  };
}
