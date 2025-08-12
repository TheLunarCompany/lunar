import { Logger } from "winston";
import { McpxOAuthProvider, McpxOAuthProviderI } from "./oauth-provider.js";

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

  constructor(
    private logger: Logger,
    options: {
      tokensDir: string;
      callbackPath?: string;
      clientName?: string;
      clientUri?: string;
      softwareId?: string;
      softwareVersion?: string;
    },
  ) {
    this.callbackPath = options.callbackPath || "/oauth/callback";
    this.clientName = options.clientName || "mcpx-server";
    this.clientUri =
      options.clientUri || "https://github.com/lunar-private/mcpx";
    this.softwareId = options.softwareId;
    this.softwareVersion = options.softwareVersion || "1.0.0";
    this.tokensDir = options.tokensDir;
    this.logger = logger.child({ component: "OAuthProviderFactory" });
  }

  /**
   * Creates a new OAuth provider for a specific server
   */
  createProvider(
    serverName: string,
    options?: {
      callbackUrl?: string;
    },
  ): McpxOAuthProviderI {
    return new McpxOAuthProvider({
      serverName,
      callbackPath: this.callbackPath,
      callbackUrl: options?.callbackUrl,
      clientName: this.clientName,
      clientUri: this.clientUri,
      softwareId: this.softwareId,
      softwareVersion: this.softwareVersion,
      logger: this.logger,
      tokensDir: this.tokensDir,
    });
  }
}
