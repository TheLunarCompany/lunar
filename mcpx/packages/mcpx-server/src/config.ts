import {
  appConfigSchema,
  NextVersionAppConfig,
  nextVersionAppConfigSchema,
  publicNewPermissionsSchema,
  PublicNextVersionAppConfig,
} from "@mcpx/shared-model";
import { stringifyEq } from "@mcpx/toolkit-core/data";
import fs from "fs";
import path from "path";
import { parse, stringify } from "yaml";
import { ZodSafeParseResult } from "zod/v4";
import { env, Env } from "./env.js";
import { Config } from "./model/config/config.js";
import { convertToNextVersionConfig } from "./services/config-versioning.js";

export const DEFAULT_CONFIG: Config = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
  },
  toolGroups: [],
  auth: { enabled: false },
  toolExtensions: { services: {} },
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
  return parseVersionedConfig(configObj);
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

  const withoutDiscriminatingTags = dropDiscriminatingTags(config);
  fs.writeFileSync(configPath, stringify(withoutDiscriminatingTags), "utf8");
}

export class ConfigManager {
  private config: Config;
  private version = 1;
  private lastModified: Date = new Date();
  private listeners = new Set<(snapshot: ConfigSnapshot) => void>();

  constructor(config: Config) {
    this.config = config;
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
      config: this.config,
      version: this.version,
      lastModified: this.lastModified,
    };
  }

  validate(env: Env): void {
    if (this.config.auth.enabled && !env.AUTH_KEY) {
      throw new Error("AUTH_KEY is required when auth is enabled");
    }
  }

  getConfig(): Config {
    return this.config;
  }

  getVersion(): number {
    return this.version;
  }

  getLastModified(): Date {
    return this.lastModified;
  }

  updateConfig(newConfig: Config): boolean {
    if (
      stringifyEq(newConfig.permissions, this.config.permissions) &&
      stringifyEq(newConfig.toolGroups, this.config.toolGroups) &&
      stringifyEq(newConfig.auth, this.config.auth) &&
      stringifyEq(newConfig.toolExtensions, this.config.toolExtensions)
    ) {
      return false; // No changes, no need to update
    }
    this.config = { ...this.config, ...newConfig };
    this.version += 1;
    this.lastModified = new Date();
    saveConfig(this.config);

    this.notifyListeners();

    return true; // Config was updated
  }
}

export function dropDiscriminatingTags(
  nextVersionConfig: NextVersionAppConfig,
): PublicNextVersionAppConfig {
  const { permissions: taggedPermissions, ...rest } = nextVersionConfig;
  const publicPermissions = taggedPermissions;
  return {
    ...rest,
    permissions: publicNewPermissionsSchema.parse(publicPermissions),
  };
}
