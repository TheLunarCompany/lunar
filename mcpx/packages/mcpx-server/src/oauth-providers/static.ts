import {
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { StaticOAuthProvider as StaticOAuthProviderConfig } from "@mcpx/shared-model";

// Type guard to ensure we have client_credentials config
type ClientCredentialsConfig = Extract<
  StaticOAuthProviderConfig,
  { authMethod: "client_credentials" }
>;
import { randomUUID } from "node:crypto";
import fs from "fs";
import path from "path";
import { Logger } from "winston";
import { env } from "../env.js";
import { McpxOAuthProviderI, OAuthProviderType } from "./model.js";
import { sanitizeFilename } from "@mcpx/toolkit-core/data";

/**
 * Generic static OAuth provider that uses pre-registered OAuth apps
 * Configuration is provided through app.yaml
 */
export class StaticOAuthProvider implements McpxOAuthProviderI {
  public type: OAuthProviderType = "static";
  public readonly serverName: string;
  private config: ClientCredentialsConfig;
  private callbackPath: string;
  private callbackUrl?: string;
  private clientId: string;
  private clientSecret: string;
  private _state: string;
  private logger: Logger;
  private tokensDir: string;
  private authorizationPromise: Promise<string | undefined> | null = null;
  private authorizationResolve: ((code?: string) => void) | null = null;
  private authorizationCode: string | null = null;
  private authorizationUrl: URL | null = null;

  constructor(options: {
    serverName: string;
    config: StaticOAuthProviderConfig;
    clientId: string;
    clientSecret: string;
    callbackPath?: string;
    callbackUrl?: string;
    logger: Logger;
    tokensDir?: string;
  }) {
    this.serverName = options.serverName;

    // Ensure we have client_credentials config
    if (options.config.authMethod !== "client_credentials") {
      throw new Error(
        `StaticOAuthProvider only supports client_credentials auth method, got: ${options.config.authMethod}`,
      );
    }
    this.config = options.config as ClientCredentialsConfig;
    this.callbackPath = options.callbackPath || "/oauth/callback";
    this.callbackUrl = options.callbackUrl;
    this._state = randomUUID();
    this.logger = options.logger.child({ component: "StaticOAuthProvider" });
    this.tokensDir =
      options.tokensDir || path.join(process.cwd(), ".mcpx", "tokens");

    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;

    // Ensure tokens directory exists
    if (!fs.existsSync(this.tokensDir)) {
      fs.mkdirSync(this.tokensDir, { recursive: true });
    }
  }

  get redirectUrl(): string {
    return (
      this.callbackUrl ||
      `${env.OAUTH_CALLBACK_BASE_URL || `http://127.0.0.1:${env.MCPX_PORT}`}${this.callbackPath}`
    );
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: this.config.tokenAuthMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: `mcpx-${this.serverName}`,
      client_uri: "https://github.com/lunar-private/mcpx",
      scope: this.config.scopes.join(" "),
    };
  }

  state(): string {
    return this._state;
  }

  async clientInformation(): Promise<OAuthClientInformationFull | undefined> {
    // For static OAuth, we return pre-registered client information
    return {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      ...this.clientMetadata,
    };
  }

  async saveClientInformation(
    _clientInformation: OAuthClientInformationFull,
  ): Promise<void> {
    // No-op for static OAuth - client info is from config
    this.logger.debug(
      "saveClientInformation called on static provider (no-op)",
      {
        serverName: this.serverName,
      },
    );
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    try {
      const tokensPath = this.getTokensPath();
      if (!fs.existsSync(tokensPath)) {
        return undefined;
      }
      const data = fs.readFileSync(tokensPath, "utf8");
      const tokens = JSON.parse(data);

      // Check if tokens are expired
      if (tokens.expires_in && tokens.expires_in <= 0) {
        this.logger.info("Tokens expired", {
          serverName: this.serverName,
        });
        return undefined;
      }

      return tokens;
    } catch (error) {
      this.logger.warn("Failed to read tokens", {
        error,
        serverName: this.serverName,
      });
      return undefined;
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    try {
      const tokensPath = this.getTokensPath();
      fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
      this.logger.debug("Tokens saved", {
        serverName: this.serverName,
      });
    } catch (error) {
      this.logger.error("Failed to save tokens", {
        error,
        serverName: this.serverName,
      });
      throw error;
    }
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    // Create a promise that will be resolved when authorization completes
    this.authorizationPromise = new Promise<string | undefined>((resolve) => {
      this.authorizationResolve = resolve;
    });

    // In a server environment, we can't automatically open a browser
    // Instead, we'll log the URL and expect the client to handle the redirect
    this.logger.info("OAuth authorization required", {
      serverName: this.serverName,
      authorizationUrl: authorizationUrl.toString(),
    });
    this.authorizationUrl = authorizationUrl;

    // Wait for authorization to complete and get the authorization code
    const authorizationCode = await this.authorizationPromise;

    // The authorization code will be processed by the MCP SDK's OAuth flow
    this.logger.info("Authorization code received", {
      serverName: this.serverName,
      hasCode: !!authorizationCode,
    });
  }

  // Method to be called by OAuth callback when authorization completes
  completeAuthorization(authorizationCode?: string): void {
    this.authorizationCode = authorizationCode || null;
    if (this.authorizationResolve) {
      this.authorizationResolve(authorizationCode);
      this.authorizationResolve = null;
      this.authorizationPromise = null;
      this.authorizationUrl = null;
    }
  }

  // Method to get the stored authorization code
  getAuthorizationCode(): string | null {
    return this.authorizationCode;
  }

  getAuthorizationUrl(): URL | null {
    return this.authorizationUrl;
  }

  getUserCode(): string | null {
    return null;
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    try {
      const verifierPath = this.getCodeVerifierPath();
      fs.writeFileSync(verifierPath, codeVerifier);
      this.logger.debug("Code verifier saved", {
        serverName: this.serverName,
      });
    } catch (error) {
      this.logger.error("Failed to save code verifier", {
        error,
        serverName: this.serverName,
      });
      throw error;
    }
  }

  async codeVerifier(): Promise<string> {
    try {
      const verifierPath = this.getCodeVerifierPath();
      if (!fs.existsSync(verifierPath)) {
        throw new Error("No code verifier found");
      }
      return fs.readFileSync(verifierPath, "utf8");
    } catch (error) {
      this.logger.error("Failed to read code verifier", {
        error,
        serverName: this.serverName,
      });
      throw error;
    }
  }

  private getTokensPath(): string {
    return path.join(
      this.tokensDir,
      `${sanitizeFilename(this.serverName)}-tokens.json`,
    );
  }

  private getCodeVerifierPath(): string {
    return path.join(
      this.tokensDir,
      `${sanitizeFilename(this.serverName)}-verifier.txt`,
    );
  }
}
