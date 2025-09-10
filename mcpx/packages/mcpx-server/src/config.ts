import {
  appConfigSchema,
  NextVersionAppConfig,
  nextVersionAppConfigSchema,
  publicNewPermissionsSchema,
  PublicNextVersionAppConfig,
  StaticOAuth,
} from "@mcpx/shared-model";
import {
  ConfigConsumer,
  ConfigManager,
  ConfigUpdateRejectedError,
} from "@mcpx/toolkit-core/config";
import { makeError, stringifyEq } from "@mcpx/toolkit-core/data";
import fs from "fs";
import path from "path";
import { parse, stringify } from "yaml";
import { ZodSafeParseResult } from "zod/v4";
import { env } from "./env.js";
import { Config } from "./model/config/config.js";
import { convertToNextVersionConfig } from "./services/config-versioning.js";
import { Logger } from "winston";
import { InvalidConfigError } from "./errors.js";
import { DEFAULT_STATIC_OAUTH } from "./oauth-providers/defaults.js";

export const DEFAULT_CONFIG: Config = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
  },
  toolGroups: [],
  auth: { enabled: false },
  toolExtensions: { services: {} },
  staticOauth: DEFAULT_STATIC_OAUTH,
};

export interface ConfigSnapshot {
  config: Config;
  version: number;
  lastModified: Date;
}

export function loadConfig(): ZodSafeParseResult<Config> {
  if (!fs.existsSync(env.APP_CONFIG_PATH)) {
    return { success: true, data: DEFAULT_CONFIG };
  }
  const rawConfig = fs.readFileSync(env.APP_CONFIG_PATH, "utf8");
  const configObj = parse(rawConfig);
  if (!configObj) {
    return { success: true, data: DEFAULT_CONFIG };
  }
  const parseResult = parseVersionedConfig(configObj);

  if (parseResult.success) {
    return {
      success: true,
      data: mergeConfigWithDefaults(parseResult.data),
    };
  }

  return parseResult;
}

// A function to allow backwards compatibility with old config format
export function parseVersionedConfig(
  rawConfig: unknown,
): ZodSafeParseResult<Config> {
  const nextVersionParse = nextVersionAppConfigSchema.safeParse(rawConfig);
  if (nextVersionParse.success) {
    return nextVersionParse;
  }
  const currentVersionParse = appConfigSchema.safeParse(rawConfig);
  if (!currentVersionParse.success) {
    // return error from next version parse - a hack but leaving it for now
    // types don't align otherwise
    return nextVersionParse;
  }

  return {
    success: true,
    data: convertToNextVersionConfig(currentVersionParse.data),
  };
}

export function saveConfig(config: Config): void {
  const configPath = path.resolve(env.APP_CONFIG_PATH);
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const fileContents = env.CONTROL_PLANE_APP_CONFIG_KEEP_DISCRIMINATING_TAGS
    ? config
    : dropDiscriminatingTags(config);

  fs.writeFileSync(configPath, stringify(fileContents), "utf8");
}

export class ConfigService {
  private listeners = new Set<(snapshot: ConfigSnapshot) => void>();
  private manager: ConfigManager<Config>;
  _initialized: boolean = false;

  constructor(config: Config, logger: Logger) {
    this.manager = new ConfigManager<Config>(config, logger);
  }

  registerConsumer(consumer: ConfigConsumer<Config>): void {
    if (this._initialized) {
      throw new Error("Cannot register consumer after initialization");
    }
    this.manager.registerConsumer(consumer);
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      throw new Error("ConfigService is already initialized");
    }
    await this.manager
      .bootstrap()
      .then(() => (this._initialized = true))
      .catch((e: unknown) => {
        const error = makeError(e);
        return Promise.reject(
          new Error(`Failed to bootstrap ConfigManager: ${error.message}`),
        );
      });
  }

  // Returns a function to unsubscribe from updates
  subscribe(cb: (snapshot: ConfigSnapshot) => void): () => void {
    this.listeners.add(cb);
    cb(this.export());

    return () => this.listeners.delete(cb);
  }

  private notifyListeners(): void {
    const snapshot = this.export();
    this.listeners.forEach((cb) => cb(snapshot));
  }

  export(): ConfigSnapshot {
    return {
      config: this.manager.currentConfig,
      version: this.manager.currentVersion,
      lastModified: this.manager.lastModified,
    };
  }

  getConfig(): Config {
    return this.manager.currentConfig;
  }

  getVersion(): number {
    return this.manager.currentVersion;
  }

  getLastModified(): Date {
    return this.manager.lastModified;
  }

  async updateConfig(newConfig: Config): Promise<boolean> {
    if (
      stringifyEq(
        newConfig.permissions,
        this.manager.currentConfig.permissions,
      ) &&
      stringifyEq(
        newConfig.toolGroups,
        this.manager.currentConfig.toolGroups,
      ) &&
      stringifyEq(newConfig.auth, this.manager.currentConfig.auth) &&
      stringifyEq(
        newConfig.toolExtensions,
        this.manager.currentConfig.toolExtensions,
      )
    ) {
      return false; // No changes, no need to update
    }

    await this.manager.updateConfig(newConfig).catch((e: unknown) => {
      if (e instanceof ConfigUpdateRejectedError) {
        return Promise.reject(
          new InvalidConfigError(`Config update rejected: ${e.message}`),
        );
      }
      return Promise.reject(e);
    });
    saveConfig(this.manager.currentConfig);

    this.notifyListeners();

    return true; // Config was updated
  }
}

export function dropDiscriminatingTags(
  nextVersionConfig: NextVersionAppConfig,
): PublicNextVersionAppConfig {
  const { permissions: taggedPermissions, ...rest } = nextVersionConfig;
  const publicPermissions = publicNewPermissionsSchema.parse(taggedPermissions);
  return {
    ...rest,
    permissions: publicPermissions,
  };
}

/**
 * Merges user config with defaults, giving precedence to user config
 */
function mergeConfigWithDefaults(userConfig: Config): Config {
  // Merge static OAuth config
  const mergedStaticOauth = mergeStaticOauth(
    DEFAULT_CONFIG.staticOauth,
    userConfig.staticOauth,
  );

  return {
    ...userConfig,
    staticOauth: mergedStaticOauth,
  };
}

/**
 * Merges static OAuth configurations with user config taking precedence
 */
function mergeStaticOauth(
  defaultConfig?: StaticOAuth,
  userConfig?: StaticOAuth,
): StaticOAuth | undefined {
  if (!defaultConfig) return userConfig;
  if (!userConfig) return defaultConfig;

  // Merge mappings - user mappings override defaults
  const mergedMapping = {
    ...defaultConfig.mapping,
    ...userConfig.mapping,
  };

  // Merge providers - user providers override defaults completely
  const mergedProviders = {
    ...defaultConfig.providers,
    ...userConfig.providers,
  };

  return {
    mapping: mergedMapping,
    providers: mergedProviders,
  };
}
