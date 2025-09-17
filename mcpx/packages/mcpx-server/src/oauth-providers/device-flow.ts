import { loggableError } from "@mcpx/toolkit-core/logging";
import {
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import fs from "fs";
import { DateTime, Duration, Interval } from "luxon";
import { randomUUID } from "node:crypto";
import path from "path";
import { Logger } from "winston";
import z from "zod/v4";
import { env } from "../env.js";
import { McpxOAuthProviderI, OAuthProviderType } from "./model.js";
import { sanitizeFilename } from "@mcpx/toolkit-core/data";

// Special signal indicating device flow has completed and tokens are ready
// This is not a real authorization code but a signal to the handler.
// Maybe future versions of the TS MCP SDK will have better support for device flow,
// at which point this will not be needed.
export const DEVICE_FLOW_COMPLETE = "__DEVICE_FLOW_TOKENS_READY__" as const;

const OAUTH_GRANT_TYPE_DEVICE_CODE =
  "urn:ietf:params:oauth:grant-type:device_code" as const;

const MAX_POLLING_INTERVAL = Duration.fromObject({ seconds: 20 });
const POLLING_BUMP_INTERVAL = Duration.fromObject({ seconds: 5 });

const OAUTH_FETCH_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
};
interface DeviceFlowConfig {
  authMethod: "device_flow";
  credentials: {
    clientIdEnv: string;
  };
  scopes: string[];
  endpoints: {
    deviceAuthorizationUrl: string;
    tokenUrl: string;
    userVerificationUrl: string;
  };
}

const deviceCodeResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  verification_url: z.string().optional(), // GitHub uses this instead
  expires_in: z.number(),
  interval: z.number().optional(),
});

const tokenResponseSchema = z.object({
  access_token: z.string().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/**
 * OAuth provider using Device Flow (RFC 8628)
 * No client secret needed.
 */
export class DeviceFlowOAuthProvider implements McpxOAuthProviderI {
  public type: OAuthProviderType = "device_flow";
  public readonly serverName: string;
  private config: DeviceFlowConfig;
  private callbackPath: string;
  private callbackUrl?: string;
  private clientId: string;
  private _state: string;
  private logger: Logger;
  private tokensDir: string;
  private authorizationCode: string | null = null;
  private authorizationUrl: URL | null = null;
  private deviceCode: string | null = null;
  private userCode: string | null = null;
  private expiresAt: number | null = null;
  private cachedTokens: OAuthTokens | null = null;
  private lastPollTime: number = 0;
  private minPollInterval: number = 5000; // 5 seconds minimum between polls

  constructor(options: {
    serverName: string;
    config: DeviceFlowConfig;
    clientId: string;
    callbackPath?: string;
    callbackUrl?: string;
    logger: Logger;
    tokensDir?: string;
  }) {
    this.serverName = options.serverName;
    this.config = options.config;
    this.callbackPath = options.callbackPath || "/oauth/callback";
    this.callbackUrl = options.callbackUrl;
    this._state = randomUUID();
    this.logger = options.logger.child({
      component: "DeviceFlowOAuthProvider",
    });
    this.tokensDir =
      options.tokensDir || path.join(process.cwd(), ".mcpx", "tokens");

    this.clientId = options.clientId;

    // Ensure tokens directory exists
    if (!fs.existsSync(this.tokensDir)) {
      fs.mkdirSync(this.tokensDir, { recursive: true });
    }
  }

  get redirectUrl(): string {
    // Device flow doesn't use redirects, but keep for compatibility
    return (
      this.callbackUrl ||
      `${env.OAUTH_CALLBACK_BASE_URL || `http://127.0.0.1:${env.MCPX_PORT}`}${this.callbackPath}`
    );
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: "none", // Device flow doesn't use client secret
      grant_types: [OAUTH_GRANT_TYPE_DEVICE_CODE, "refresh_token"],
      response_types: ["device_code"],
      client_name: `mcpx-${this.serverName}`,
      client_uri: "https://github.com/lunar-private/mcpx",
      scope: this.config.scopes.join(" "),
    };
  }

  state(): string {
    return this._state;
  }

  async clientInformation(): Promise<OAuthClientInformationFull | undefined> {
    // For device flow, we only need client_id, no secret
    return {
      client_id: this.clientId,
      client_secret: "", // Empty string for compatibility
      ...this.clientMetadata,
    };
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await fs.promises.writeFile(
      this.getTokensPath(),
      JSON.stringify(tokens, null, 2),
    );
    this.cachedTokens = tokens; // Cache in memory for immediate availability
    this.logger.info("Tokens saved", { serverName: this.serverName });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    // Return cached tokens first if available (for device flow immediate use)
    if (this.cachedTokens) {
      return this.cachedTokens;
    }

    try {
      const data = await fs.promises.readFile(this.getTokensPath(), "utf-8");
      const tokens = JSON.parse(data);
      this.cachedTokens = tokens; // Cache for next time
      return tokens;
    } catch {
      return undefined;
    }
  }

  private async requestDeviceCode(): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.config.scopes.join(" "),
    });

    try {
      const response = await globalThis.fetch(
        this.config.endpoints.deviceAuthorizationUrl,
        {
          method: "POST",
          headers: OAUTH_FETCH_HEADERS,
          body: params.toString(),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Device authorization failed: ${error}`);
      }

      const data = await response.json();
      const parsed = deviceCodeResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(
          `Invalid device code response: ${parsed.error.message}`,
        );
      }

      this.deviceCode = parsed.data.device_code;
      this.userCode = parsed.data.user_code;
      this.expiresAt = Date.now() + parsed.data.expires_in * 1000;

      // Store verification URL (GitHub uses verification_url, others use verification_uri)
      const verificationUrl =
        parsed.data.verification_url || parsed.data.verification_uri;
      if (verificationUrl) {
        this.authorizationUrl = new URL(verificationUrl);
      } else {
        this.authorizationUrl = new URL(
          this.config.endpoints.userVerificationUrl,
        );
      }

      this.logger.info("Device code obtained", {
        serverName: this.serverName,
        userCode: this.userCode,
        expiresIn: parsed.data.expires_in,
      });
    } catch (error) {
      this.logger.error("Failed to request device code", { error });
      throw error;
    }
  }

  private logUserCode(): void {
    if (!this.userCode || !this.authorizationUrl) {
      throw new Error("Device code not available");
    }

    const minutesUntilExpiration = this.minutesUntilExpiration();

    this.logger.info(
      `Device-Flow authorization required, visit ${this.authorizationUrl.toString()} and enter code: ${this.userCode}.${
        minutesUntilExpiration
          ? ` Code expires in ${Math.round(minutesUntilExpiration)} minutes.`
          : ""
      }`,
    );
  }

  private minutesUntilExpiration(): number | undefined {
    if (!this.expiresAt) return undefined;
    return Interval.fromDateTimes(
      DateTime.now(),
      DateTime.fromMillis(this.expiresAt),
    )
      .toDuration()
      .as("minutes");
  }
  getAuthorizationCode(): string | null {
    // In device flow, we poll for the token directly
    // This method is called repeatedly by the connection handler
    if (this.authorizationCode) {
      return this.authorizationCode;
    }

    // Check if expired
    if (this.expiresAt && Date.now() > this.expiresAt) {
      this.logger.error("Device code expired", {
        serverName: this.serverName,
      });
      return null;
    }

    // Rate limit polling to respect server requirements
    // GitHub requires at least 5 seconds between polls
    const now = Date.now();
    const timeSinceLastPoll = now - this.lastPollTime;
    if (timeSinceLastPoll < this.minPollInterval) {
      // Too soon to poll again, skip this attempt
      return null;
    }

    // Update last poll time and perform a single poll attempt
    this.lastPollTime = now;
    this.pollForToken().catch((error) => {
      this.logger.debug("Poll attempt failed", { error: loggableError(error) });
    });

    return null;
  }

  private async pollForToken(): Promise<void> {
    if (!this.deviceCode) {
      throw new Error("Device code not available");
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      device_code: this.deviceCode,
      grant_type: OAUTH_GRANT_TYPE_DEVICE_CODE,
    });

    try {
      const response = await globalThis.fetch(this.config.endpoints.tokenUrl, {
        method: "POST",
        headers: OAUTH_FETCH_HEADERS,
        body: params.toString(),
      });

      const data = await response.json();
      const parsed = tokenResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(`Invalid token response: ${parsed.error.message}`);
      }

      if (data.error) {
        if (data.error === "authorization_pending") {
          // User hasn't authorized yet, keep polling
          this.logger.debug("Authorization pending", {
            serverName: this.serverName,
          });
          return;
        } else if (data.error === "slow_down") {
          // RFC 8628 requires increasing polling interval by 5 seconds
          // Increase our minimum interval to respect the server's request
          this.minPollInterval = Math.min(
            this.minPollInterval + POLLING_BUMP_INTERVAL.toMillis(),
            MAX_POLLING_INTERVAL.toMillis(),
          );
          this.logger.debug("Server requested slower polling", {
            serverName: this.serverName,
            newInterval: this.minPollInterval / 1000,
          });
          return;
        } else {
          throw new Error(
            `Token error: ${data.error} - ${data.error_description}`,
          );
        }
      }

      if (parsed.data.access_token) {
        // Success! Save tokens
        const tokens: OAuthTokens = {
          access_token: parsed.data.access_token,
          token_type: parsed.data.token_type || "Bearer",
          scope: parsed.data.scope,
          refresh_token: parsed.data.refresh_token,
          expires_in: parsed.data.expires_in,
        };

        await this.saveTokens(tokens);

        // Signal that device flow is complete and tokens are ready
        this.authorizationCode = DEVICE_FLOW_COMPLETE;

        this.logger.info("Device flow authorization successful", {
          serverName: this.serverName,
        });
      }
    } catch (error) {
      this.logger.error("Failed to poll for token", { error });
      throw error;
    }
  }

  completeAuthorization(authorizationCode?: string): void {
    // In device flow, authorization is completed via polling
    // This method is for compatibility
    if (authorizationCode) {
      this.authorizationCode = authorizationCode;
    }
  }

  getAuthorizationUrl(): URL | null {
    return this.authorizationUrl;
  }

  getUserCode(): string | null {
    return this.userCode;
  }

  async redirectToAuthorization(): Promise<void> {
    // Device flow doesn't redirect, it shows instructions instead
    // Start device flow authorization
    await this.requestDeviceCode();

    // Display instructions to user
    this.logUserCode();
  }

  async saveCodeVerifier(_verifier: string): Promise<void> {
    // Device flow doesn't use PKCE code verifier
    // This is a no-op for compatibility
  }

  async codeVerifier(): Promise<string> {
    // Device flow doesn't use PKCE code verifier
    // Return empty string for compatibility
    return "";
  }

  private getTokensPath(): string {
    return path.join(
      this.tokensDir,
      `${sanitizeFilename(this.serverName)}-tokens.json`,
    );
  }
}
