import { stringifyEq } from "@mcpx/toolkit-core/data";
import fs from "fs";
import path from "path";
import { parse, stringify } from "yaml";
import { ZodSafeParseResult } from "zod/v4";
import { env, Env } from "./env.js";
import { Config } from "./model.js";
import { configSchema } from "@mcpx/shared-model";

export const DEFAULT_CONFIG: Config = {
  permissions: {
    base: "allow" as const,
    consumers: {},
  },
  toolGroups: [],
  auth: {
    enabled: false,
  },
  toolExtensions: { services: {} },
};

export function loadConfig(): ZodSafeParseResult<Config> {
  if (!fs.existsSync(env.APP_CONFIG_PATH)) {
    return { success: true, data: DEFAULT_CONFIG };
  }
  const rawConfig = fs.readFileSync(env.APP_CONFIG_PATH, "utf8");
  const configObj = parse(rawConfig);
  if (!configObj) {
    return { success: true, data: DEFAULT_CONFIG };
  }
  return configSchema.safeParse(configObj);
}

export function saveConfig(config: Config): void {
  const configPath = path.resolve(env.APP_CONFIG_PATH);
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, stringify(config), "utf8");
}

export class ConfigManager {
  private config: Config;
  private version = 1;
  private lastModified: Date = new Date();

  constructor(config: Config) {
    this.config = config;
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
    return true; // Config was updated
  }
}
