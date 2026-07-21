import {
  resolveClientCredentials,
  resolveClientId,
} from "../oauth-providers/resolve-credentials.js";
import { ConfigConsumer } from "@mcpx/toolkit-core/config";
import { CredentialField } from "@mcpx/shared-model";
import { env } from "../env.js";
import { Config } from "../model/config/config.js";
import { OauthCredentialResolver } from "./env-var-manager.js";
import { compact } from "@mcpx/toolkit-core/data";

// This class validates that a given `Config` object can
// be used with the given environment variables.
export class ConfigValidator implements ConfigConsumer<Config> {
  constructor(private envVars: OauthCredentialResolver) {}
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
  envVars: OauthCredentialResolver,
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
  credentials: { clientId: CredentialField; clientSecret: CredentialField },
): string {
  const base = `Static OAuth provider ${providerName} is missing credentials.`;
  const missingEnvNames = compact([
    credentials.clientId.type === "envRef"
      ? credentials.clientId.envName
      : null,
    credentials.clientSecret.type === "envRef"
      ? credentials.clientSecret.envName
      : null,
  ]);
  if (missingEnvNames.length === 0) return base;
  return `${base} Ensure ${missingEnvNames.join(" and ")} environment variable${missingEnvNames.length > 1 ? "s are" : " is"} available.`;
}

function missingClientIdMessage(
  providerName: string,
  credentials: { clientId: CredentialField },
): string {
  const base = `Device flow OAuth provider ${providerName} is missing client ID.`;
  if (credentials.clientId.type === "literal") return base;
  return `${base} Ensure ${credentials.clientId.envName} environment variable is available.`;
}
