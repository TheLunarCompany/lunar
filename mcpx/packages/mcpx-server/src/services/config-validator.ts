import {
  isLiteralCredentials,
  resolveClientCredentials,
  resolveClientId,
} from "../oauth-providers/resolve-credentials.js";
import { ConfigConsumer } from "@mcpx/toolkit-core/config";
import { env } from "../env.js";
import { Config } from "../model/config/config.js";
import { EnvVarResolver } from "./env-var-manager.js";

// This class validates that a given `Config` object can
// be used with the given environment variables.
export class ConfigValidator implements ConfigConsumer<Config> {
  constructor(private envVars: EnvVarResolver) {}
  readonly name = "ConfigValidator";
  async prepareConfig(newConfig: Config): Promise<void> {
    await validateAuthKey(newConfig);
    await validateStaticOAuthProviders(newConfig, this.envVars);
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

function validateStaticOAuthProviders(
  newConfig: Config,
  envVars: EnvVarResolver,
): Promise<void> {
  if (newConfig.staticOauth) {
    for (const [providerName, provider] of Object.entries(
      newConfig.staticOauth.providers,
    )) {
      if (provider.authMethod === "client_credentials") {
        if (!resolveClientCredentials(provider.credentials, envVars)) {
          return Promise.reject(
            new Error(
              missingCredentialsMessage(providerName, provider.credentials),
            ),
          );
        }
      } else if (provider.authMethod === "device_flow") {
        if (!resolveClientId(provider.credentials, envVars)) {
          return Promise.reject(
            new Error(
              missingClientIdMessage(providerName, provider.credentials),
            ),
          );
        }
      }
    }
  }
  return Promise.resolve();
}

function missingCredentialsMessage(
  providerName: string,
  credentials:
    | { clientIdEnv: string; clientSecretEnv: string }
    | { clientId: string; clientSecret: string },
): string {
  const base = `Static OAuth provider ${providerName} is missing credentials.`;
  if (isLiteralCredentials(credentials)) return base;
  return `${base} Please set ${credentials.clientIdEnv} and ${credentials.clientSecretEnv} environment variables.`;
}

function missingClientIdMessage(
  providerName: string,
  credentials: { clientIdEnv: string } | { clientId: string },
): string {
  const base = `Device flow OAuth provider ${providerName} is missing client ID.`;
  if (isLiteralCredentials(credentials)) return base;
  return `${base} Please set ${credentials.clientIdEnv} environment variable.`;
}
