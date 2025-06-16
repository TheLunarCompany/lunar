import fs from "fs";
import { parse } from "yaml";
import { ZodSafeParseResult } from "zod/v4";
import { env, Env } from "./env.js";
import { Config, configSchema } from "./model.js";
import { stringifyEq } from "@mcpx/toolkit-core/data";

export const DEFAULT_CONFIG = {
  permissions: {
    base: "allow" as const,
    consumers: {},
  },
  toolGroups: [],
  auth: {
    enabled: false,
  },
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

  updateConfig(newConfig: Config): void {
    if (
      stringifyEq(newConfig.permissions, this.config.permissions) &&
      stringifyEq(newConfig.toolGroups, this.config.toolGroups) &&
      stringifyEq(newConfig.auth, this.config.auth)
    ) {
      return; // No changes, no need to update
    }
    this.config = { ...this.config, ...newConfig };
    this.version += 1;
    this.lastModified = new Date();
  }
}
