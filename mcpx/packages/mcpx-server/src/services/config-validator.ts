import {
  resolveClientCredentials,
  resolveClientId,
} from "../oauth-providers/resolve-credentials.js";
import { ConfigConsumer } from "@aigw/core/config";
import { CredentialField } from "@mcpx/shared-model";
import { Logger } from "winston";
import { env } from "../env.js";
import { Config } from "../model/config/config.js";
import { OauthCredentialResolver } from "./env-var-manager.js";
import { CatalogHostsResolver } from "./catalog-manager.js";
import { compact } from "@aigw/core/data";

// This class validates that a given `Config` object can
// be used with the given environment variables.
export class ConfigValidator implements ConfigConsumer<Config> {
  constructor(
    private envVars: OauthCredentialResolver,
    private catalogResolver: CatalogHostsResolver,
    private logger: Logger,
  ) {}
  readonly name = "ConfigValidator";
  async prepareConfig(newConfig: Config): Promise<void> {
    await validateAuthKey(newConfig);
    await validateStaticOAuthProviders(
      newConfig,
      this.envVars,
      this.catalogResolver,
      this.logger,
    );
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
  catalogResolver: CatalogHostsResolver,
  logger: Logger,
): Promise<void> {
  if (newConfig.staticOauth) {
    const { mapping, providers } = newConfig.staticOauth;
    const hostsByProvider = new Map<string, string[]>();
    for (const [host, providerName] of Object.entries(mapping)) {
      const mappedHosts = hostsByProvider.get(providerName) ?? [];
      mappedHosts.push(host);
      hostsByProvider.set(providerName, mappedHosts);
    }

    for (const [providerName, provider] of Object.entries(providers)) {
      const mappedHosts = hostsByProvider.get(providerName) ?? [];
      const usedByCatalog = mappedHosts.some((host) =>
        catalogResolver.isHostInCatalog(host),
      );

      if (!usedByCatalog) {
        logger.debug(
          "Skipping static OAuth provider because none of its mapped hosts are in the current catalog",
          { skippedProvider: providerName, providerHosts: mappedHosts },
        );
        continue;
      }

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

      logger.debug("Resolved credentials for static OAuth provider", {
        providerName,
        authMethod: provider.authMethod,
      });
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
