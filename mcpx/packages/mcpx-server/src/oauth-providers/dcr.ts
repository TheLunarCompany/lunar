import {
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { randomUUID } from "node:crypto";
import { Logger } from "winston";
import { env } from "../env.js";
import { McpxOAuthProviderI, OAuthProviderType } from "./model.js";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";
import { applyExpiryPolicy, withExpiresAt } from "./token-helpers.js";

/**
 * Generic static OAuth provider for Dynamic Client Registration (DCR) flow.
 * Manages OAuth tokens for connecting to multiple target MCP servers
 */
export class DcrOAuthProvider implements McpxOAuthProviderI {
  public type: OAuthProviderType = "dcr";
  public readonly serverName: string;
  private callbackPath: string;
  private callbackUrl?: string;
  private clientName: string;
  private clientUri: string;
  private softwareId: string;
  private softwareVersion: string;
  private _state: string;
  private logger: Logger;
  private tokenStore: OAuthTokenStoreI;
  private authorizationCode: string | null = null;
  private authorizationUrl: URL | null = null;
  private discoveredScope: string | null = null;

  constructor(options: {
    serverName: string;
    callbackPath?: string;
    callbackUrl?: string;
    clientName?: string;
    clientUri?: string;
    softwareId?: string;
    softwareVersion?: string;
    logger: Logger;
    tokenStore: OAuthTokenStoreI;
  }) {
    this.serverName = options.serverName;
    this.callbackPath = options.callbackPath || "/oauth/callback";
    this.callbackUrl = options.callbackUrl;
    this.clientName = options.clientName || "mcpx-server";
    this.clientUri =
      options.clientUri || "https://github.com/lunar-private/mcpx";
    this.softwareId = options.softwareId || randomUUID();
    this.softwareVersion = options.softwareVersion || "1.0.0";
    this._state = randomUUID();
    this.logger = options.logger.child({ component: "OAuthProvider" });
    this.tokenStore = options.tokenStore;
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
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: this.clientName,
      client_uri: this.clientUri,
      software_id: this.softwareId,
      software_version: this.softwareVersion,
      ...(this.discoveredScope ? { scope: this.discoveredScope } : {}),
    };
  }

  setDiscoveredScope(scope: string): void {
    this.discoveredScope = scope;
  }

  state(): string {
    return this._state;
  }

  async clientInformation(): Promise<OAuthClientInformationFull | undefined> {
    try {
      return await this.tokenStore.loadClientInfo(this.serverName);
    } catch (error) {
      this.logger.warn("Failed to read client information", {
        error,
        serverName: this.serverName,
      });
      return undefined;
    }
  }

  async saveClientInformation(
    clientInformation: OAuthClientInformationFull,
  ): Promise<void> {
    try {
      await this.tokenStore.saveClientInfo(this.serverName, clientInformation);
      this.logger.info("Client information saved", {
        serverName: this.serverName,
      });
    } catch (error) {
      this.logger.error("Failed to save client information", {
        error,
        serverName: this.serverName,
      });
      throw error;
    }
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    try {
      const stored = await this.tokenStore.loadTokens(this.serverName);
      if (!stored) return undefined;
      return applyExpiryPolicy({
        stored,
        serverName: this.serverName,
        logger: this.logger,
      });
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
      await this.tokenStore.saveTokens(this.serverName, withExpiresAt(tokens));
      this.logger.debug("Tokens saved", { serverName: this.serverName });
    } catch (error) {
      this.logger.error("Failed to save tokens", {
        error,
        serverName: this.serverName,
      });
      throw error;
    }
  }

  // Non-blocking: record the URL and return. The SDK then throws
  // UnauthorizedError. Interactive auth completes later via the /oauth/callback
  // -> finishAuth() path; silent token reuse fails fast instead of hanging on a
  // user who may never come back.
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    // Force account selection so users can switch accounts via delete+re-add
    authorizationUrl.searchParams.set("prompt", "select_account");
    this.authorizationUrl = authorizationUrl;

    this.logger.info("OAuth authorization required", {
      serverName: this.serverName,
      authorizationUrl: authorizationUrl.toString(),
    });
  }

  completeAuthorization(authorizationCode?: string): void {
    this.authorizationCode = authorizationCode || null;
    this.authorizationUrl = null; // flow is finishing; drop the pending URL
  }

  getAuthorizationCode(): string | null {
    return this.authorizationCode;
  }

  getUserCode(): string | null {
    return null;
  }

  getAuthorizationUrl(): URL | null {
    return this.authorizationUrl;
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
