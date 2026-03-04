import { ConfigConsumer } from "@mcpx/toolkit-core/config";
import { env } from "../env.js";
import { Config } from "../model/config/config.js";

// This class validates that a given `Config` object can
// be used with the given environment variables.
export class ConfigValidator implements ConfigConsumer<Config> {
  constructor() {}
  readonly name = "ConfigValidator";
  async prepareConfig(newConfig: Config): Promise<void> {
    await validateAuthKey(newConfig);
    await validateStaticOAuthProviders(newConfig);
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

function validateAuthKey(newConfig: Config): Promise<void> {
  if (newConfig.auth.enabled && !env.AUTH_KEY) {
    return Promise.reject(
      new Error("AUTH_KEY is required when auth is enabled"),
    );
  }
  return Promise.resolve();
}

function validateStaticOAuthProviders(newConfig: Config): Promise<void> {
  if (newConfig.staticOauth) {
    for (const [providerName, provider] of Object.entries(
      newConfig.staticOauth.providers,
    )) {
      // read the env vars to make sure they are set
      const clientId = process.env[provider.credentials.clientIdEnv];

      // Check if client secret is needed based on auth method
      if (provider.authMethod === "client_credentials") {
        const clientSecret = process.env[provider.credentials.clientSecretEnv];
        if (!clientId || !clientSecret) {
          return Promise.reject(
            new Error(
              `Static OAuth provider ${providerName} is missing credentials. Please set ${provider.credentials.clientIdEnv} and ${provider.credentials.clientSecretEnv} environment variables.`,
            ),
          );
        }
      } else if (provider.authMethod === "device_flow") {
        if (!clientId) {
          return Promise.reject(
            new Error(
              `Device flow OAuth provider ${providerName} is missing client ID. Please set ${provider.credentials.clientIdEnv} environment variable.`,
            ),
          );
        }
      }
    }
  }
  return Promise.resolve();
}
