import { Logger } from "winston";
import { ConfigManager } from "../config.js";
import type {
  ConsumerConfig,
  DefaultAllowConsumerConfig,
  Permission,
  PermissionsConfig,
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

export class PermissionManager {
  private initialized = false;
  private permissionsConfig: PermissionsConfig;
  private consumers: Map<string, ConsumerLevelPermission> = new Map();
  private defaultConsumer: ConsumerLevelPermission | null = null;
  private toolGroupByName: Record<string, Record<string, ServiceToolGroup>> =
    {};

  private config: ConfigManager;
  private logger: Logger;

  private usedConfigVersion: number = 0;

  constructor(config: ConfigManager, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ component: "PermissionManager" });

    this.permissionsConfig = config.getConfig().permissions;
  }

  initialize(): void {
    // Zero out previous state if existing
    this.initialized = false;
    this.permissionsConfig = this.config.getConfig().permissions;
    this.consumers = new Map();
    this.defaultConsumer = null;
    this.toolGroupByName = {};

    // Fill in new state
    this.toolGroupByName = this.config
      .getConfig()
      .toolGroups.reduce<typeof this.toolGroupByName>((acc, group) => {
        acc[group.name] = group.services;
        return acc;
      }, {});

    // Initialize anonymous consumer
    this.defaultConsumer = this.buildConsumerPermissions(
      this.permissionsConfig.default,
    );

    // Initialize regular consumers
    Object.entries(this.permissionsConfig.consumers).forEach(([name, config]) =>
      this.consumers.set(name, this.buildConsumerPermissions(config)),
    );

    // Mark flags
    this.initialized = true;
    this.usedConfigVersion = this.config.getVersion();

    this.logger.debug("PermissionManager re/initialized", {
      anonymousConsumer: this.defaultConsumer,
      consumersNames: Array.from(this.consumers.keys()),
      usedConfigVersion: this.usedConfigVersion,
    });
  }

  hasPermission(props: {
    serviceName: string;
    toolName: string;
    consumerTag?: string;
  }): boolean {
    if (!this.initialized) {
      throw new Error("PermissionManager not initialized");
    }
    if (this.usedConfigVersion !== this.config.getVersion()) {
      this.logger.info(
        "PermissionManager config version changed, reinitializing",
      );
      this.initialize();
    }
    const { consumerTag, serviceName, toolName } = props;

    const consumer = consumerTag ? this.consumers.get(consumerTag) : null;
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
    if (!this.defaultConsumer) {
      throw new Error("Anonymous consumer not initialized");
    }

    const service = this.defaultConsumer.services.get(serviceName);
    if (!service) {
      return this.defaultConsumer.default === "allow";
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

  private buildConsumerPermissions(
    config: ConsumerConfig,
  ): ConsumerLevelPermission {
    const services = new Map<string, ServiceLevelPermission>();

    let defaultPermission: Permission;
    if (isDefaultAllowConsumer(config)) {
      this.addServices(services, config.block, "block");
      defaultPermission = "allow";
    } else {
      this.addServices(services, config.allow, "allow");
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

function isDefaultAllowConsumer(
  config: ConsumerConfig,
): config is DefaultAllowConsumerConfig {
  return config._type === "default-allow";
}
