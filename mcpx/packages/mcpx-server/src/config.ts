import { appConfigSchema } from "@mcpx/shared-model";
import {
  ConfigConsumer,
  ConfigManager,
  ConfigUpdateRejectedError,
} from "@mcpx/toolkit-core/config";
import { AsyncMutex } from "@mcpx/toolkit-core/concurrency";
import { makeError, stringifyEq } from "@mcpx/toolkit-core/data";
import fs from "fs";
import path from "path";
import { Logger } from "winston";
import { parse, stringify } from "yaml";
import { ZodSafeParseResult } from "zod/v4";
import { InvalidConfigError } from "./errors.js";
import { Config } from "./model/config/config.js";

export const DEFAULT_CONFIG: Config = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
    clientNames: {},
  },
  toolGroups: [],
  auth: { enabled: false },
  toolExtensions: { services: {} },
  targetServerAttributes: {},
};

export interface ConfigSnapshot {
  config: Config;
  version: number;
  lastModified: Date;
}

export interface ConfigSubscribeMetadata {
  prevConfig: Config | undefined;
}

export type ConfigSubscriber = (
  snapshot: ConfigSnapshot,
  metadata: ConfigSubscribeMetadata,
) => void;

export interface ConfigStore {
  load(): ZodSafeParseResult<Config>;
  save(config: Config): void;
}

export class FileConfigStore implements ConfigStore {
  constructor(private readonly filePath: string) {}

  load(): ZodSafeParseResult<Config> {
    if (!fs.existsSync(this.filePath)) {
      return { success: true, data: DEFAULT_CONFIG };
    }
    const rawConfig = fs.readFileSync(this.filePath, "utf8");
    const configObj = parse(rawConfig);
    if (!configObj) {
      return { success: true, data: DEFAULT_CONFIG };
    }
    return appConfigSchema.safeParse(configObj);
  }

  save(config: Config): void {
    const resolved = path.resolve(this.filePath);
    const configDir = path.dirname(resolved);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(resolved, stringify(config), "utf8");
  }
}

// Hub is the source of truth in enterprise mode; persisted disk state would
// drift (e.g. envRefs referencing hub-only env vars) and break boot validation.
export class InMemoryConfigStore implements ConfigStore {
  load(): ZodSafeParseResult<Config> {
    return { success: true, data: DEFAULT_CONFIG };
  }

  save(): void {}
}

export class ConfigService {
  private listeners = new Set<ConfigSubscriber>();
  private manager: ConfigManager<Config>;
  private logger: Logger;
  private mutex = new AsyncMutex();
  private isLockHeld = false;
  _initialized: boolean = false;

  constructor(
    config: Config,
    private readonly store: ConfigStore,
    logger: Logger,
  ) {
    this.manager = new ConfigManager<Config>(config, logger);
    this.logger = logger.child({ component: "ConfigService" });
  }

  registerConsumer(consumer: ConfigConsumer<Config>): void {
    if (this._initialized) {
      throw new Error("Cannot register consumer after initialization");
    }
    this.manager.registerConsumer(consumer);
  }

  registerPostCommitHook(
    hook: (committedConfig: Config) => Promise<void>,
  ): void {
    this.manager.registerPostCommitHook(hook);
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

    this.logger.info("ConfigService initialized successfully");
  }

  // Returns a function to unsubscribe from updates
  subscribe(cb: ConfigSubscriber): () => void {
    this.listeners.add(cb);
    cb(this.export(), { prevConfig: undefined });

    return () => this.listeners.delete(cb);
  }

  private notifyListeners(metadata: ConfigSubscribeMetadata): void {
    const snapshot = this.export();
    this.listeners.forEach((cb) => cb(snapshot, metadata));
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

  /**
   * Execute a function while holding the config lock.
   * Use this to wrap read-modify-write operations to prevent race conditions.
   *
   * @param fn - The async function to execute while holding the lock
   * @returns The result of the function
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    return this.mutex.withLock(async () => {
      this.isLockHeld = true;
      try {
        return await fn();
      } finally {
        this.isLockHeld = false;
      }
    });
  }

  /**
   * Update the config atomically.
   * MUST be called within withLock() - will throw otherwise.
   */
  async updateConfig(newConfig: Config): Promise<boolean> {
    if (!this.isLockHeld) {
      throw new Error(
        "updateConfig must be called within withLock to prevent race conditions",
      );
    }

    if (stringifyEq(newConfig, this.manager.currentConfig)) {
      return false; // No changes, no need to update
    }

    const prevConfig = this.manager.currentConfig;
    await this.manager.updateConfig(newConfig).catch((e: unknown) => {
      if (e instanceof ConfigUpdateRejectedError) {
        return Promise.reject(
          new InvalidConfigError(`Config update rejected: ${e.message}`),
        );
      }
      return Promise.reject(e);
    });
    this.store.save(this.manager.currentConfig);

    this.notifyListeners({ prevConfig });

    return true; // Config was updated
  }
}
