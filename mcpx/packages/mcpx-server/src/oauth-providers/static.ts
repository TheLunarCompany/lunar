import {
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { StaticOAuthProvider as StaticOAuthProviderConfig } from "@mcpx/shared-model";

type ClientCredentialsConfig = Extract<
  StaticOAuthProviderConfig,
  { authMethod: "client_credentials" }
>;
import { randomUUID } from "node:crypto";
import { Logger } from "winston";
import { env } from "../env.js";
import { McpxOAuthProviderI, OAuthProviderType } from "./model.js";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";

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
  private tokenStore: OAuthTokenStoreI;
  private authorizationPromise: Promise<string | undefined> | null = null;
  private authorizationResolve: ((code?: string) => void) | null = null;
  private authorizationCode: string | null = null;
  private authorizationUrl: URL | null = null;
  private discoveredScope: string | null = null;

  constructor(options: {
    serverName: string;
    config: StaticOAuthProviderConfig;
    clientId: string;
    clientSecret: string;
    callbackPath?: string;
    callbackUrl?: string;
    logger: Logger;
    tokenStore: OAuthTokenStoreI;
  }) {
    this.serverName = options.serverName;

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
    this.tokenStore = options.tokenStore;

    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
  }

  get redirectUrl(): string {
    return (
      this.callbackUrl ||
      `${env.OAUTH_CALLBACK_BASE_URL || `http://127.0.0.1:${env.MCPX_PORT}`}${this.callbackPath}`
    );
  }

  get clientMetadata(): OAuthClientMetadata {
    const baseScopes = this.config.scopes.join(" ");
    const scope =
      this.discoveredScope && !this.config.scopes.includes(this.discoveredScope)
        ? `${baseScopes} ${this.discoveredScope}`
        : baseScopes;
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: this.config.tokenAuthMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: `mcpx-${this.serverName}`,
      client_uri: "https://github.com/lunar-private/mcpx",
      scope,
    };
  }

  setDiscoveredScope(scope: string): void {
    this.discoveredScope = scope;
  }

  state(): string {
    return this._state;
  }

  async clientInformation(): Promise<OAuthClientInformationFull | undefined> {
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
      { serverName: this.serverName },
    );
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    try {
      const stored = await this.tokenStore.loadTokens(this.serverName);
      if (!stored) return undefined;

      if (stored.expires_at != null && Date.now() > stored.expires_at) {
        this.logger.info("Tokens expired", { serverName: this.serverName });
        return undefined;
      }

      return stored;
    } catch (error) {
      this.logger.warn("Failed to read tokens", {
        error,
        serverName: this.serverName,
      });
      throw error;
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    try {
      const stored = {
        ...tokens,
        ...(tokens.expires_in != null
          ? { expires_at: Date.now() + tokens.expires_in * 1000 }
          : {}),
      };
      await this.tokenStore.saveTokens(this.serverName, stored);
      this.logger.debug("Tokens saved", { serverName: this.serverName });
    } catch (error) {
      this.logger.error("Failed to save tokens", {
        error,
        serverName: this.serverName,
      });
      throw error;
    }
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    this.authorizationPromise = new Promise<string | undefined>((resolve) => {
      this.authorizationResolve = resolve;
    });

    // Force account selection so users can switch accounts via delete+re-add
    authorizationUrl.searchParams.set("prompt", "select_account");

    // In a server environment, we can't automatically open a browser
    // Instead, we'll log the URL and expect the client to handle the redirect
    this.logger.info("OAuth authorization required", {
      serverName: this.serverName,
      authorizationUrl: authorizationUrl.toString(),
    });
    this.authorizationUrl = authorizationUrl;

    const authorizationCode = await this.authorizationPromise;

    this.logger.info("Authorization code received", {
      serverName: this.serverName,
      hasCode: !!authorizationCode,
    });
  }

  completeAuthorization(authorizationCode?: string): void {
    this.authorizationCode = authorizationCode || null;
    if (this.authorizationResolve) {
      this.authorizationResolve(authorizationCode);
      this.authorizationResolve = null;
      this.authorizationPromise = null;
      this.authorizationUrl = null;
    }
  }

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
      await this.tokenStore.saveCodeVerifier(this.serverName, codeVerifier);
      this.logger.debug("Code verifier saved", { serverName: this.serverName });
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
      const verifier = await this.tokenStore.loadCodeVerifier(this.serverName);
      if (!verifier) {
        throw new Error("No code verifier found");
      }
      return verifier;
    } catch (error) {
      this.logger.error("Failed to read code verifier", {
        error,
        serverName: this.serverName,
      });
      throw error;
    }
  }
}
