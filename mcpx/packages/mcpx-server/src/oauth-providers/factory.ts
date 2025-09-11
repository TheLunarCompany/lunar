import { StaticOAuth } from "@mcpx/shared-model";
import { Logger } from "winston";
import { DcrOAuthProvider } from "./dcr.js";
import { DeviceFlowOAuthProvider } from "./device-flow.js";
import { McpxOAuthProviderI } from "./model.js";
import { StaticOAuthProvider } from "./static.js";

/**
 * Factory for creating OAuth providers with consistent configuration
 */
export class OAuthProviderFactory {
  private callbackPath: string;
  private clientName: string;
  private clientUri: string;
  private softwareId?: string;
  private softwareVersion?: string;
  private tokensDir?: string;
  private staticOauthConfig?: StaticOAuth;

  constructor(
    private logger: Logger,
    options: {
      tokensDir: string;
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
    this.tokensDir = options.tokensDir;
    this.staticOauthConfig = options.staticOauthConfig;
    this.logger = logger.child({ component: "OAuthProviderFactory" });
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

    // Check static OAuth mapping
    if (this.staticOauthConfig?.mapping) {
      const domain = new URL(serverUrl).hostname;
      const providerKey = this.staticOauthConfig.mapping[domain];

      if (providerKey && this.staticOauthConfig.providers?.[providerKey]) {
        const providerConfig = this.staticOauthConfig.providers[providerKey];

        // Check auth method to determine which provider to use
        switch (providerConfig.authMethod) {
          case "device_flow": {
            this.logger.info("Using device flow OAuth provider", {
              serverName,
              serverUrl,
              providerKey,
              domain,
            });

            return new DeviceFlowOAuthProvider({
              serverName,
              config: providerConfig,
              callbackPath: this.callbackPath,
              callbackUrl,
              logger: this.logger,
              tokensDir: this.tokensDir,
            });
          }
          case "client_credentials": {
            this.logger.info(
              "Using static OAuth provider (client credentials)",
              {
                serverName,
                serverUrl,
                providerKey,
                domain,
              },
            );

            return new StaticOAuthProvider({
              serverName,
              config: providerConfig,
              callbackPath: this.callbackPath,
              callbackUrl,
              logger: this.logger,
              tokensDir: this.tokensDir,
            });
          }
        }
      }
    }

    // Default to DCR provider for all other servers
    this.logger.info(
      "Trying to use a Dynamic-Client-Registration OAuth provider",
      { serverName, serverUrl },
    );

    return new DcrOAuthProvider({
      serverName,
      callbackPath: this.callbackPath,
      callbackUrl,
      clientName: this.clientName,
      clientUri: this.clientUri,
      softwareId: this.softwareId,
      softwareVersion: this.softwareVersion,
      logger: this.logger,
      tokensDir: this.tokensDir,
    });
  }
}
