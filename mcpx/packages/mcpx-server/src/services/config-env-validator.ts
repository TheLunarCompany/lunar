import { ConfigConsumer } from "@mcpx/toolkit-core/config";
import { env } from "../env.js";
import { Config } from "../model/config/config.js";

// This class validates that a given `Config` object can
// be used with the given environment variables.
export class ConfigEnvValidator implements ConfigConsumer<Config> {
  constructor() {}
  readonly name = "ConfigEnvValidator";
  prepareConfig(newConfig: Config): Promise<void> {
    if (newConfig.auth.enabled && !env.AUTH_KEY) {
      return Promise.reject(
        new Error("AUTH_KEY is required when auth is enabled"),
      );
    }
    return Promise.resolve();
  }
  async commitConfig(): Promise<void> {
    // No state to swap, this is just a validation step
    return Promise.resolve();
  }
  rollbackConfig(): void {
    // No state to rollback, this is just a validation step
  }
}
