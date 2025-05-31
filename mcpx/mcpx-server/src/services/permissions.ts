import { logger } from "../logger.js";
import type {
  Config,
  ConsumerConfig,
  Permission,
  PermissionsConfig,
  ServiceToolGroup,
} from "../model.js";

type ServiceLevelPermission =
  | { tag: "allow_all" }
  | { tag: "block_all" }
  | { tag: "allow"; value: Set<string> }
  | { tag: "block"; value: Set<string> };

interface ConsumerLevelPermission {
  base: Permission;
  services: Map<string, ServiceLevelPermission>;
}

export class PermissionManager {
  private initialized = false;
  private permissionsConfig: PermissionsConfig;
  private consumers: Map<string, ConsumerLevelPermission> = new Map();
  private toolGroupByName: Record<string, Record<string, ServiceToolGroup>> =
    {};

  constructor(config: Config) {
    const { permissions, toolGroups } = config;
    this.toolGroupByName = toolGroups.reduce<typeof this.toolGroupByName>(
      (acc, group) => {
        acc[group.name] = group.services;
        return acc;
      },
      {},
    );
    this.permissionsConfig = permissions;
  }

  initialize(): void {
    if (this.initialized) {
      throw new Error("PermissionManager already initialized");
    }
    Object.entries(this.permissionsConfig.consumers).forEach((pair) =>
      this.addConsumer(pair),
    );
    this.initialized = true;
    logger.debug("PermissionManager initialized", {
      globalBase: this.permissionsConfig.base,
      consumers: Array.from(this.consumers.keys()),
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
    const { consumerTag, serviceName, toolName } = props;

    const consumer = consumerTag ? this.consumers.get(consumerTag) : null;
    if (!consumer) {
      return this.permissionsConfig.base === "allow";
    }

    const { base: consumerBase, services } = consumer;
    const service = services.get(serviceName);
    if (!service) {
      return consumerBase === "allow";
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

  private addConsumer([name, config]: [string, ConsumerConfig]): void {
    const { base: consumerBase, profiles } = config;
    const base = consumerBase ?? this.permissionsConfig.base;
    const services = new Map<string, ServiceLevelPermission>();
    this.addServices(services, profiles?.allow || [], "allow");
    this.addServices(services, profiles?.block || [], "block");
    this.consumers.set(name, { base, services });
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
  if (typeof serviceToolGroup === "string") {
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

// Merge is only supported for same type ServicePermission
function mergeServicePermissions(
  existing: ServiceLevelPermission,
  current: ServiceLevelPermission,
): ServiceLevelPermission {
  if (existing.tag === "allow_all" && current.tag === "allow_all") {
    return existing;
  } else if (existing.tag === "block_all" && current.tag === "block_all") {
    return existing;
  } else if (existing.tag === "allow" && current.tag === "allow") {
    return {
      tag: "allow",
      value: new Set([...existing.value, ...current.value]),
    };
  } else if (existing.tag === "block" && current.tag === "block") {
    return {
      tag: "block",
      value: new Set([...existing.value, ...current.value]),
    };
  } else {
    throw new Error("Incompatible ServiceLevelPermissions, cannot merge");
  }
}
