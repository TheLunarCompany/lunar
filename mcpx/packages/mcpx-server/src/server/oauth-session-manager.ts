import { StaticOAuth } from "@mcpx/shared-model";
import { ConfigConsumer } from "@mcpx/toolkit-core/config";
import { Logger } from "winston";
import { OAuthProviderFactory } from "../oauth-providers/factory.js";
import { McpxOAuthProviderI } from "../oauth-providers/model.js";
import { Config } from "../model/config/config.js";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";

// Time between OAuth flow creation and expiration
// This is not the token expiration time, but the flow state expiration time
const STALENESS_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

export interface OAuthFlowState {
  serverName: string;
  serverUrl: string;
  state: string;
  createdAt: Date;
}

export interface OAuthSessionManagerI {
  getOrCreateOAuthProvider(options: {
    serverName: string;
    serverUrl: string;
    callbackUrl?: string;
  }): McpxOAuthProviderI;
  hasOAuthProvider(serverName: string): boolean;
  getExistingOAuthProvider(serverName: string): McpxOAuthProviderI | undefined;
  startOAuthFlow(serverName: string, serverUrl: string, state: string): void;
  getOAuthFlow(state: string): OAuthFlowState | undefined;
  completeOAuthFlow(state: string): OAuthFlowState | undefined;
  deleteOAuthTokensForServer(serverName: string): Promise<void>;
}
/**
 * Manages OAuth sessions for a single user connecting to multiple MCP servers.
 * Implements ConfigConsumer to react to staticOauth config changes from apply-setup.
 */
export class OAuthSessionManager implements ConfigConsumer<Config> {
  readonly name = "OAuthSessionManager";
  private oauthProviders: Map<string, McpxOAuthProviderI> = new Map();
  private activeFlows: Map<string, OAuthFlowState> = new Map(); // state -> flow info
  private logger: Logger;
  private tokenStore: OAuthTokenStoreI;
  private providerFactory: OAuthProviderFactory;
  private nextFactory: OAuthProviderFactory | null = null;

  constructor(
    logger: Logger,
    tokenStore: OAuthTokenStoreI,
    staticOauthConfig?: StaticOAuth,
    providerFactory?: OAuthProviderFactory,
  ) {
    this.logger = logger;
    this.tokenStore = tokenStore;
    this.providerFactory =
      providerFactory ||
      new OAuthProviderFactory(logger, {
        tokenStore,
        staticOauthConfig,
      });
  }

  prepareConfig(newConfig: Config): Promise<void> {
    this.logger.info("Preparing OAuthProviderFactory with staticOauth config", {
      providerKeys: Object.keys(newConfig.staticOauth?.providers ?? {}),
      mappingDomains: Object.keys(newConfig.staticOauth?.mapping ?? {}),
    });
    this.nextFactory = new OAuthProviderFactory(this.logger, {
      tokenStore: this.tokenStore,
      staticOauthConfig: newConfig.staticOauth,
    });
    return Promise.resolve();
  }

  async commitConfig(): Promise<void> {
    if (!this.nextFactory) {
      return Promise.reject(new Error("No next factory to commit"));
    }
    this.providerFactory = this.nextFactory;
    this.nextFactory = null;
    this.oauthProviders.clear();
    this.logger.info(
      "Rebuilt OAuthProviderFactory with updated staticOauth config",
    );
  }

  rollbackConfig(): void {
    this.nextFactory = null;
  }

  /**
   * Gets or creates an OAuth provider for a connection to a specific MCP server
   */
  getOrCreateOAuthProvider(options: {
    serverName: string;
    serverUrl: string;
    callbackUrl?: string;
  }): McpxOAuthProviderI {
    const { serverName, serverUrl, callbackUrl } = options;

    let provider = this.oauthProviders.get(serverName);
    if (
      !provider ||
      (callbackUrl &&
        callbackUrl !== provider?.getAuthorizationUrl()?.toString())
    ) {
      provider = this.providerFactory.createProvider({
        serverName,
        serverUrl,
        callbackUrl,
      });
      this.oauthProviders.set(serverName, provider);
      this.logger.info("Created OAuth provider for server", {
        serverName,
        serverUrl,
        providerServerName: provider.serverName,
      });
    }

    return provider;
  }

  hasOAuthProvider(serverName: string): boolean {
    return this.oauthProviders.has(serverName);
  }

  getExistingOAuthProvider(serverName: string): McpxOAuthProviderI | undefined {
    return this.oauthProviders.get(serverName);
  }

  /**
   * Starts an OAuth flow and tracks the state
   */
  startOAuthFlow(serverName: string, serverUrl: string, state: string): void {
    const flowState: OAuthFlowState = {
      serverName,
      serverUrl,
      state,
      createdAt: new Date(),
    };

    this.activeFlows.set(state, flowState);
    this.logger.info("Started OAuth flow", { serverName, state });

    // Clean up old flows (older than 10 minutes)
    this.cleanupExpiredFlows();
  }

  /**
   * Retrieves OAuth flow information by state
   */
  getOAuthFlow(state: string): OAuthFlowState | undefined {
    return this.activeFlows.get(state);
  }

  /**
   * Completes an OAuth flow and removes it from active flows
   */
  completeOAuthFlow(state: string): OAuthFlowState | undefined {
    const flow = this.activeFlows.get(state);
    if (flow) {
      this.activeFlows.delete(state);
      this.logger.info("Completed OAuth flow", {
        serverName: flow.serverName,
        state,
      });
    }
    return flow;
  }

  /**
   * Deletes stored OAuth tokens for the given server and removes it from the provider cache.
   */
  async deleteOAuthTokensForServer(serverName: string): Promise<void> {
    this.oauthProviders.delete(serverName);
    await this.providerFactory.deleteTokensForServer(serverName);
    this.logger.info("Deleted OAuth tokens for server", { serverName });
  }

  /**
   * Removes expired OAuth flows
   */
  private cleanupExpiredFlows(): void {
    const now = new Date();
    const expiredFlows: string[] = [];

    for (const [state, flow] of this.activeFlows) {
      const ageMs = now.getTime() - flow.createdAt.getTime();
      if (ageMs > STALENESS_THRESHOLD_MS) {
        expiredFlows.push(state);
      }
    }

    for (const state of expiredFlows) {
      this.activeFlows.delete(state);
      this.logger.info("Cleaned up expired OAuth flow", { state });
    }
  }
}
