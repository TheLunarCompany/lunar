import {
  ConsumerConfig,
  Permissions,
  ToolExtension,
  ToolExtensions,
  ToolGroup,
  ToolGroupUpdate,
} from "@mcpx/shared-model";
import { indexBy, mapValues } from "@mcpx/toolkit-core/data";
import { LunarLogger } from "@mcpx/toolkit-core/logging";
import { ConfigService, ConfigSnapshot } from "../config.js";
import { AlreadyExistsError, NotFoundError } from "../errors.js";
import { Config, TargetServerAttributes } from "../model/config/config.js";
export class ControlPlaneConfigService {
  private configService: ConfigService;
  private logger: LunarLogger;

  constructor(configService: ConfigService, logger: LunarLogger) {
    this.configService = configService;
    this.logger = logger.child({ component: "ControlPlaneConfigService" });
  }

  // ==================== CONFIG SERVICE DELEGATION ====================

  subscribe(callback: (snapshot: ConfigSnapshot) => void): () => void {
    return this.configService.subscribe(callback);
  }

  getVersion(): number {
    return this.configService.getVersion();
  }

  getLastModified(): Date {
    return this.configService.getLastModified();
  }

  getSnapshot(): ConfigSnapshot {
    return this.configService.export();
  }

  getConfig(): Config {
    return this.configService.getConfig();
  }

  // ==================== TOOL GROUPS ====================

  getToolGroups(): ToolGroup[] {
    return this.configService.getConfig().toolGroups;
  }

  getToolGroup(props: { name: string }): ToolGroup | undefined {
    const { name } = props;
    const toolGroupsByName = indexBy(
      this.configService.getConfig().toolGroups,
      (g) => g.name,
    );
    return toolGroupsByName[name];
  }

  async addToolGroup(props: { group: ToolGroup }): Promise<ToolGroup> {
    return this.configService.withLock(async () => {
      const { group } = props;
      const currentConfig = this.configService.getConfig();
      const toolGroupsByName = indexBy(currentConfig.toolGroups, (g) => g.name);

      if (toolGroupsByName[group.name]) {
        throw new AlreadyExistsError(
          `Tool group '${group.name}' already exists`,
        );
      }

      const updatedConfig = {
        ...currentConfig,
        toolGroups: [...currentConfig.toolGroups, group],
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(`Tool group '${group.name}' added successfully`);
      return group;
    });
  }

  async updateToolGroup(props: {
    name: string;
    updates: ToolGroupUpdate;
  }): Promise<ToolGroup> {
    return this.configService.withLock(async () => {
      const { name, updates } = props;
      const currentConfig = this.configService.getConfig();
      const toolGroupsByName = indexBy(currentConfig.toolGroups, (g) => g.name);

      if (!toolGroupsByName[name]) {
        throw new NotFoundError(`Tool group '${name}' not found`);
      }

      const effectiveName = updates.name ?? name;
      const isNameChange = effectiveName !== name;
      if (isNameChange && toolGroupsByName[updates.name!]) {
        throw new AlreadyExistsError(
          `Tool group name '${updates.name}' is already in use`,
        );
      }
      const updatedGroup: ToolGroup = { ...updates, name: effectiveName };
      const { [name]: _, ...rest } = toolGroupsByName;
      const updatedToolGroupsByName = {
        ...rest,
        [effectiveName]: updatedGroup,
      };

      const updatedPermissions = ensureUpdatedToolGroupNamesInPermissions({
        permissions: currentConfig.permissions,
        toolGroupNameUpdate: { from: name, to: effectiveName },
      });

      const updatedConfig = {
        ...currentConfig,
        permissions: updatedPermissions,
        toolGroups: Object.values(updatedToolGroupsByName),
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(`Tool group '${name}' updated successfully`, {
        name,
        updatedName: isNameChange ? effectiveName : undefined,
      });
      return updatedGroup;
    });
  }

  async deleteToolGroup(props: { name: string }): Promise<void> {
    return this.configService.withLock(async () => {
      const { name } = props;
      const currentConfig = this.configService.getConfig();
      const toolGroupsByName = indexBy(currentConfig.toolGroups, (g) => g.name);

      if (!toolGroupsByName[name]) {
        throw new NotFoundError(`Tool group '${name}' not found`);
      }

      const { [name]: _, ...remaining } = toolGroupsByName;

      const updatedConfig = {
        ...currentConfig,
        toolGroups: Object.values(remaining),
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(`Tool group '${name}' deleted successfully`);
    });
  }

  // ==================== PERMISSIONS ====================

  getPermissions(): Permissions {
    return this.configService.getConfig().permissions;
  }

  getDefaultPermission(): ConsumerConfig {
    return this.configService.getConfig().permissions.default;
  }

  async updateDefaultPermission(props: {
    config: ConsumerConfig;
  }): Promise<ConsumerConfig> {
    return this.configService.withLock(async () => {
      const { config } = props;
      const currentConfig = this.configService.getConfig();
      const updatedConfig = {
        ...currentConfig,
        permissions: {
          ...currentConfig.permissions,
          default: config,
        },
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info("Default permission updated successfully");
      return config;
    });
  }

  getPermissionConsumers(): Record<string, ConsumerConfig> {
    return this.getPermissionEntries("consumers");
  }

  getPermissionConsumer(props: { name: string }): ConsumerConfig | undefined {
    return this.getPermissionEntry({ scope: "consumers", name: props.name });
  }

  async addPermissionConsumer(props: {
    name: string;
    config: ConsumerConfig;
  }): Promise<ConsumerConfig> {
    return this.addPermissionEntry({ scope: "consumers", ...props });
  }

  async updatePermissionConsumer(props: {
    name: string;
    config: ConsumerConfig;
  }): Promise<ConsumerConfig> {
    return this.updatePermissionEntry({ scope: "consumers", ...props });
  }

  async deletePermissionConsumer(props: { name: string }): Promise<void> {
    return this.deletePermissionEntry({ scope: "consumers", name: props.name });
  }

  getPermissionClientNames(): Record<string, ConsumerConfig> {
    return this.getPermissionEntries("clientNames");
  }

  getPermissionClientName(props: { name: string }): ConsumerConfig | undefined {
    return this.getPermissionEntry({ scope: "clientNames", name: props.name });
  }

  async addPermissionClientName(props: {
    name: string;
    config: ConsumerConfig;
  }): Promise<ConsumerConfig> {
    return this.addPermissionEntry({ scope: "clientNames", ...props });
  }

  async updatePermissionClientName(props: {
    name: string;
    config: ConsumerConfig;
  }): Promise<ConsumerConfig> {
    return this.updatePermissionEntry({ scope: "clientNames", ...props });
  }

  async deletePermissionClientName(props: { name: string }): Promise<void> {
    return this.deletePermissionEntry({
      scope: "clientNames",
      name: props.name,
    });
  }

  // ==================== TOOL EXTENSIONS ====================

  getToolExtensions(): ToolExtensions {
    return this.configService.getConfig().toolExtensions;
  }

  getToolExtension(props: {
    serverName: string;
    originalToolName: string;
    customToolName: string;
  }): ToolExtension | undefined {
    const { serverName, originalToolName, customToolName } = props;
    const extensions = this.configService.getConfig().toolExtensions;
    const childTools =
      extensions.services[serverName]?.[originalToolName]?.childTools;
    return childTools?.find((t) => t.name === customToolName);
  }

  async addToolExtension(props: {
    serverName: string;
    originalToolName: string;
    extension: ToolExtension;
  }): Promise<ToolExtension> {
    return this.configService.withLock(async () => {
      const { serverName, originalToolName, extension } = props;
      const currentConfig = this.configService.getConfig();
      const extensions = currentConfig.toolExtensions;
      const existingChildTools =
        extensions.services[serverName]?.[originalToolName]?.childTools ?? [];

      if (existingChildTools.some((t) => t.name === extension.name)) {
        throw new AlreadyExistsError(
          `Tool extension '${extension.name}' already exists for ${serverName}/${originalToolName}`,
        );
      }

      const updatedConfig = {
        ...currentConfig,
        toolExtensions: {
          services: {
            ...extensions.services,
            [serverName]: {
              ...extensions.services[serverName],
              [originalToolName]: {
                childTools: [...existingChildTools, extension],
              },
            },
          },
        },
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(
        `Tool extension '${extension.name}' added to ${serverName}/${originalToolName}`,
      );
      return extension;
    });
  }

  async updateToolExtension(props: {
    serverName: string;
    originalToolName: string;
    customToolName: string;
    updates: Omit<ToolExtension, "name">;
  }): Promise<ToolExtension> {
    return this.configService.withLock(async () => {
      const { serverName, originalToolName, customToolName, updates } = props;
      const currentConfig = this.configService.getConfig();
      const extensions = currentConfig.toolExtensions;
      const existingChildTools =
        extensions.services[serverName]?.[originalToolName]?.childTools;

      if (!existingChildTools?.some((t) => t.name === customToolName)) {
        throw new NotFoundError(
          `Tool extension '${customToolName}' not found for ${serverName}/${originalToolName}`,
        );
      }

      const updatedExtension: ToolExtension = {
        ...updates,
        name: customToolName,
      };
      const updatedChildTools = existingChildTools.map((t) =>
        t.name === customToolName ? updatedExtension : t,
      );

      const updatedConfig = {
        ...currentConfig,
        toolExtensions: {
          services: {
            ...extensions.services,
            [serverName]: {
              ...extensions.services[serverName],
              [originalToolName]: {
                childTools: updatedChildTools,
              },
            },
          },
        },
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(
        `Tool extension '${customToolName}' updated for ${serverName}/${originalToolName}`,
      );
      return updatedExtension;
    });
  }

  async deleteToolExtension(props: {
    serverName: string;
    originalToolName: string;
    customToolName: string;
  }): Promise<void> {
    return this.configService.withLock(async () => {
      const { serverName, originalToolName, customToolName } = props;
      const currentConfig = this.configService.getConfig();
      const extensions = currentConfig.toolExtensions;
      const existingChildTools =
        extensions.services[serverName]?.[originalToolName]?.childTools;

      if (!existingChildTools?.some((t) => t.name === customToolName)) {
        throw new NotFoundError(
          `Tool extension '${customToolName}' not found for ${serverName}/${originalToolName}`,
        );
      }

      const updatedChildTools = existingChildTools.filter(
        (t) => t.name !== customToolName,
      );

      const updatedConfig = {
        ...currentConfig,
        toolExtensions: {
          services: {
            ...extensions.services,
            [serverName]: {
              ...extensions.services[serverName],
              [originalToolName]: {
                childTools: updatedChildTools,
              },
            },
          },
        },
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(
        `Tool extension '${customToolName}' deleted from ${serverName}/${originalToolName}`,
      );
    });
  }

  // ==================== SERVER ATTRIBUTES ====================

  async activateTargetServer(name: string): Promise<void> {
    return this.configService.withLock(async () => {
      const normalizedName = name.trim().toLowerCase();
      this.logger.info(
        "Received ActivateTargetServer event from Control Plane",
        { normalizedName },
      );

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
    });
  }

  async deactivateTargetServer(name: string): Promise<void> {
    return this.configService.withLock(async () => {
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
    });
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

  async removeTargetServerAttribute(name: string): Promise<void> {
    return this.configService.withLock(async () => {
      this.logger.info(
        "Received RemoveTargetServerAttribute event from Control Plane",
        { name },
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
    });
  }

  // ==================== PERMISSION ENTRIES (private polymorphic core) ====================

  private getPermissionEntries(
    scope: PermissionScope,
  ): Record<string, ConsumerConfig> {
    return this.configService.getConfig().permissions[scope];
  }

  private getPermissionEntry(props: {
    scope: PermissionScope;
    name: string;
  }): ConsumerConfig | undefined {
    return this.configService.getConfig().permissions[props.scope][props.name];
  }

  private async addPermissionEntry(props: {
    scope: PermissionScope;
    name: string;
    config: ConsumerConfig;
  }): Promise<ConsumerConfig> {
    return this.configService.withLock(async () => {
      const { scope, name, config } = props;
      const label = scopeLabel(scope);
      const currentConfig = this.configService.getConfig();
      if (currentConfig.permissions[scope][name]) {
        throw new AlreadyExistsError(
          `Permission ${label} '${name}' already exists`,
        );
      }
      const updatedConfig = {
        ...currentConfig,
        permissions: {
          ...currentConfig.permissions,
          [scope]: {
            ...currentConfig.permissions[scope],
            [name]: config,
          },
        },
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(`Permission ${label} '${name}' added successfully`);
      return config;
    });
  }

  private async updatePermissionEntry(props: {
    scope: PermissionScope;
    name: string;
    config: ConsumerConfig;
  }): Promise<ConsumerConfig> {
    return this.configService.withLock(async () => {
      const { scope, name, config } = props;
      const label = scopeLabel(scope);
      const currentConfig = this.configService.getConfig();
      if (!currentConfig.permissions[scope][name]) {
        throw new NotFoundError(`Permission ${label} '${name}' not found`);
      }
      const updatedConfig = {
        ...currentConfig,
        permissions: {
          ...currentConfig.permissions,
          [scope]: {
            ...currentConfig.permissions[scope],
            [name]: config,
          },
        },
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(`Permission ${label} '${name}' updated successfully`);
      return config;
    });
  }

  private async deletePermissionEntry(props: {
    scope: PermissionScope;
    name: string;
  }): Promise<void> {
    return this.configService.withLock(async () => {
      const { scope, name } = props;
      const label = scopeLabel(scope);
      const currentConfig = this.configService.getConfig();
      if (!currentConfig.permissions[scope][name]) {
        throw new NotFoundError(`Permission ${label} '${name}' not found`);
      }
      const { [name]: _, ...remaining } = currentConfig.permissions[scope];
      const updatedConfig = {
        ...currentConfig,
        permissions: {
          ...currentConfig.permissions,
          [scope]: remaining,
        },
      };
      await this.configService.updateConfig(updatedConfig);
      this.logger.info(`Permission ${label} '${name}' deleted successfully`);
    });
  }
}

type PermissionScope = "consumers" | "clientNames";

function scopeLabel(scope: PermissionScope): "consumer" | "clientName" {
  return scope === "consumers" ? "consumer" : "clientName";
}

function ensureUpdatedToolGroupNamesInPermissions(props: {
  permissions: Permissions;
  toolGroupNameUpdate: { from: string; to: string };
}): Permissions {
  const { permissions, toolGroupNameUpdate } = props;
  const { from, to } = toolGroupNameUpdate;

  if (from === to) {
    // No change
    return permissions;
  }

  // local helper - if itemName matches 'from', change it to 'to'
  const changeName = (itemName: string): string => {
    return itemName === from ? to : itemName;
  };

  function updatePermissionConsumerConfig(
    consumerConfig: ConsumerConfig,
  ): ConsumerConfig {
    if (consumerConfig._type === "default-block") {
      return {
        ...consumerConfig,
        allow: consumerConfig.allow.map(changeName),
      };
    }
    return {
      ...consumerConfig,
      block: consumerConfig.block.map(changeName),
    };
  }

  return {
    default: updatePermissionConsumerConfig(permissions.default),
    consumers: mapValues(permissions.consumers, updatePermissionConsumerConfig),
    clientNames: mapValues(
      permissions.clientNames,
      updatePermissionConsumerConfig,
    ),
  };
}
