import { StaticOAuth } from "@mcpx/shared-model";
import {
  resolveClientId,
  resolveClientCredentials,
} from "./resolve-credentials.js";
import { Logger } from "winston";
import { DcrOAuthProvider } from "./dcr.js";
import { DeviceFlowOAuthProvider } from "./device-flow.js";
import { McpxOAuthProviderI } from "./model.js";
import { StaticOAuthProvider } from "./static.js";
import { DEFAULT_STATIC_OAUTH } from "./defaults.js";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";

/**
 * Factory for creating OAuth providers with consistent configuration
 */
export class OAuthProviderFactory {
  private callbackPath: string;
  private clientName: string;
  private clientUri: string;
  private softwareId?: string;
  private softwareVersion?: string;
  private staticOauthConfig?: StaticOAuth;
  private tokenStore: OAuthTokenStoreI;

  constructor(
    private logger: Logger,
    options: {
      tokenStore: OAuthTokenStoreI;
      callbackPath?: string;
      clientName?: string;
      clientUri?: string;
      softwareId?: string;
      softwareVersion?: string;
      staticOauthConfig?: StaticOAuth;
    },
  ) {
    this.callbackPath = options.callbackPath || "/oauth/callback";
    this.clientName = options.clientName || "mcpx-server";
    this.clientUri =
      options.clientUri || "https://github.com/lunar-private/mcpx";
    this.softwareId = options.softwareId;
    this.softwareVersion = options.softwareVersion || "1.0.0";
    this.tokenStore = options.tokenStore;
    this.staticOauthConfig = options.staticOauthConfig;
    this.logger = logger.child({ component: "OAuthProviderFactory" });
  }

  /**
   * Deletes all OAuth credential entries for a given server.
   */
  async deleteTokensForServer(serverName: string): Promise<void> {
    await this.tokenStore.deleteAll(serverName).catch((error) => {
      this.logger.warn("Failed to delete OAuth credentials", {
        serverName,
        error,
      });
    });
  }

  /**
   * Creates a new OAuth provider for a specific server
   */
  createProvider(options: {
    serverName: string;
    serverUrl: string;
    callbackUrl?: string;
  }): McpxOAuthProviderI {
    const { serverName, serverUrl, callbackUrl } = options;

    const userConfigRes = this.createFromConfig(
      this.staticOauthConfig,
      "user-defined",
      options,
    );
    if (userConfigRes) {
      this.logger.info(
        "Using static OAuth provider from user-supplied config",
        { serverName, serverUrl, type: userConfigRes.type },
      );
      return userConfigRes;
    }

    const defaultConfigRes = this.createFromConfig(
      DEFAULT_STATIC_OAUTH,
      "system-defined",
      options,
    );
    if (defaultConfigRes) {
      this.logger.info("Using static OAuth provider from default config", {
        serverName,
        serverUrl,
        type: defaultConfigRes.type,
      });
      return defaultConfigRes;
    }

    // Default to DCR provider for all other servers
    this.logger.info("Building Dynamic-Client-Registration OAuth provider", {
      serverName,
      serverUrl,
    });

    return new DcrOAuthProvider({
      serverName,
      callbackPath: this.callbackPath,
      callbackUrl,
      clientName: this.clientName,
      clientUri: this.clientUri,
      softwareId: this.softwareId,
      softwareVersion: this.softwareVersion,
      logger: this.logger,
      tokenStore: this.tokenStore,
    });
  }

  private createFromConfig(
    config: StaticOAuth,
    kind: "user-defined" | "system-defined",
    options: {
      serverName: string;
      serverUrl: string;
      callbackUrl?: string;
    },
  ): McpxOAuthProviderI | undefined {
    const { serverName, serverUrl, callbackUrl } = options;
    const domain = new URL(serverUrl).hostname;

    const providerKey = config?.mapping[domain];
    if (!providerKey) return;

    const providerConfig = config.providers[providerKey];
    if (!providerConfig) return;

    this.logger.info("Found static OAuth provider config", {
      serverName,
      serverUrl,
      providerKey,
      domain,
      definedBy: kind,
    });

    switch (providerConfig.authMethod) {
      case "device_flow": {
        this.logger.info("Trying to build a device-flow OAuth provider", {
          serverName,
          serverUrl,
          providerKey,
          domain,
        });

        const clientId = resolveClientId(providerConfig.credentials);
        if (!clientId) {
          if (kind === "user-defined") {
            this.logger.warn(
              `Missing client ID for server ${serverName}. Skipping Static OAuth provider creation.`,
            );
          }
          this.logger.debug("Falling back to DCR provider instead", {
            serverName,
          });
          return;
        }
        return new DeviceFlowOAuthProvider({
          serverName,
          config: providerConfig,
          clientId,
          callbackPath: this.callbackPath,
          callbackUrl,
          logger: this.logger,
          tokenStore: this.tokenStore,
        });
      }
      case "client_credentials": {
        this.logger.info(
          "Trying to build a static OAuth provider (client-credentials)",
          { serverName, serverUrl, providerKey, domain },
        );

        const resolved = resolveClientCredentials(providerConfig.credentials);
        if (!resolved) {
          if (kind === "user-defined") {
            this.logger.warn(
              `Missing client credentials for server ${serverName}. Skipping Static OAuth provider creation.`,
            );
          }
          this.logger.debug("Falling back to DCR provider instead", {
            serverName,
          });
          return;
        }
        return new StaticOAuthProvider({
          serverName,
          config: providerConfig,
          clientId: resolved.clientId,
          clientSecret: resolved.clientSecret,
          callbackPath: this.callbackPath,
          callbackUrl,
          logger: this.logger,
          tokenStore: this.tokenStore,
        });
      }
    }
  }
}
