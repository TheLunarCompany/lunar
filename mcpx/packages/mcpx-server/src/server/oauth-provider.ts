import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { randomUUID } from "node:crypto";
import fs from "fs";
import path from "path";
import { Logger } from "winston";
import { env } from "../env.js";

// Our custom OAuth provider interface narrows down `state` and adds methods.
export type McpxOAuthProviderI = Omit<OAuthClientProvider, "state"> & {
  state(): string;
  completeAuthorization(authorizationCode?: string): void;
  getAuthorizationCode(): string | null;
  getAuthorizationUrl(): URL | null;
};

/**
 * OAuth provider for mcpx-server
 * Manages OAuth tokens for connecting to multiple target MCP servers
 */
export class McpxOAuthProvider implements OAuthClientProvider {
  private serverName: string;
  private callbackPath: string;
  private callbackUrl?: string;
  private clientName: string;
  private clientUri: string;
  private softwareId: string;
  private softwareVersion: string;
  private _state: string;
  private logger: Logger;
  private tokensDir: string;
  private authorizationPromise: Promise<string | undefined> | null = null;
  private authorizationResolve: ((code?: string) => void) | null = null;
  private authorizationCode: string | null = null;
  private authorizationUrl: URL | null = null;

  constructor(options: {
    serverName: string;
    callbackPath?: string;
    callbackUrl?: string;
    clientName?: string;
    clientUri?: string;
    softwareId?: string;
    softwareVersion?: string;
    logger: Logger;
    tokensDir?: string;
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
    this.tokensDir =
      options.tokensDir || path.join(process.cwd(), ".mcpx", "tokens");

    // Ensure tokens directory exists
    if (!fs.existsSync(this.tokensDir)) {
      fs.mkdirSync(this.tokensDir, { recursive: true });
    }
  }

  get redirectUrl(): string {
    return (
      this.callbackUrl ||
      `http://127.0.0.1:${env.MCPX_PORT}${this.callbackPath}`
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
    };
  }

  state(): string {
    return this._state;
  }

  async clientInformation(): Promise<OAuthClientInformationFull | undefined> {
    try {
      const clientPath = this.getClientInfoPath();
      if (!fs.existsSync(clientPath)) {
        return undefined;
      }
      const data = fs.readFileSync(clientPath, "utf8");
      return JSON.parse(data);
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
      const clientPath = this.getClientInfoPath();
      fs.writeFileSync(clientPath, JSON.stringify(clientInformation, null, 2));
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
      this.logger.info("Tokens saved", {
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

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    try {
      const verifierPath = this.getCodeVerifierPath();
      fs.writeFileSync(verifierPath, codeVerifier);
      this.logger.info("Code verifier saved", {
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
    return path.join(this.tokensDir, `${this.serverName}-tokens.json`);
  }

  private getClientInfoPath(): string {
    return path.join(this.tokensDir, `${this.serverName}-client.json`);
  }

  private getCodeVerifierPath(): string {
    return path.join(this.tokensDir, `${this.serverName}-verifier.txt`);
  }
}
