import { StaticOAuth } from "@mcpx/shared-model";
import { ConfigConsumer } from "@mcpx/toolkit-core/config";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import { OAuthProviderFactory } from "../oauth-providers/factory.js";
import { McpxOAuthProviderI } from "../oauth-providers/model.js";
import { Config } from "../model/config/config.js";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";
import { OauthCredentialResolver } from "../services/env-var-manager.js";
import { CatalogManagerI } from "../services/catalog-manager.js";

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
    catalogItemId?: string;
  }): McpxOAuthProviderI;
  hasOAuthProvider(serverName: string): boolean; // Runtime: is a provider already instantiated for this server name?
  hasCatalogItemOAuth(catalogItemId: string): boolean;
  hasStaticOAuthForUrl(serverUrl: string): boolean; // Config: is static OAuth configured for this server's host?
  getExistingOAuthProvider(serverName: string): McpxOAuthProviderI | undefined;
  hasPersistedOAuthTokens(serverName: string): Promise<boolean>;
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
  private envVars: OauthCredentialResolver;
  private catalogManager: CatalogManagerI;
  private providerFactory: OAuthProviderFactory;
  private nextFactory: OAuthProviderFactory | null = null;

  constructor(
    logger: Logger,
    tokenStore: OAuthTokenStoreI,
    envVars: OauthCredentialResolver,
    catalogManager: CatalogManagerI,
    staticOauthConfig?: StaticOAuth,
    providerFactory?: OAuthProviderFactory,
  ) {
    this.logger = logger;
    this.tokenStore = tokenStore;
    this.envVars = envVars;
    this.catalogManager = catalogManager;
    this.providerFactory =
      providerFactory ||
      new OAuthProviderFactory(logger, {
        tokenStore,
        envVars,
        staticOauthConfig,
      });
    // subscribe to catalog changes to keep the Oauth cached data updated
    this.catalogManager.subscribe(async (change) => {
      try {
        for (const serverName of [
          ...change.staticOauthPerServersChange,
          ...change.removedServers,
        ]) {
          await this.deleteOAuthTokensForServer(serverName);
        }
      } catch (e) {
        this.logger.error("Failed to delete OAuth tokens on catalog change", {
          error: loggableError(e),
        });
      }
    });
  }

  prepareConfig(newConfig: Config): Promise<void> {
    this.logger.info("Preparing OAuthProviderFactory with staticOauth config", {
      providerKeys: Object.keys(newConfig.staticOauth?.providers ?? {}),
      mappingDomains: Object.keys(newConfig.staticOauth?.mapping ?? {}),
    });
    this.nextFactory = new OAuthProviderFactory(this.logger, {
      tokenStore: this.tokenStore,
      envVars: this.envVars,
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
    catalogItemId?: string;
  }): McpxOAuthProviderI {
    const { serverName, serverUrl, callbackUrl, catalogItemId } = options;

    let provider = this.oauthProviders.get(serverName);
    if (
      !provider ||
      (callbackUrl &&
        callbackUrl !== provider?.getAuthorizationUrl()?.toString())
    ) {
      provider = this.createProvider({
        serverName,
        serverUrl,
        callbackUrl,
        catalogItemId,
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

  private createProvider(options: {
    serverName: string;
    serverUrl: string;
    callbackUrl?: string;
    catalogItemId?: string;
  }): McpxOAuthProviderI {
    const { serverName, serverUrl, callbackUrl, catalogItemId } = options;

    // Priority 1: per-catalog-item static OAuth
    if (catalogItemId) {
      const itemOauthConfig =
        this.catalogManager.getPerCatalogItemOAuth(catalogItemId);
      if (itemOauthConfig) {
        this.logger.debug(`Got catalog item oauth for ${serverName} server`);
        return this.providerFactory.createFromLiteralConfig(itemOauthConfig, {
          serverName,
          serverUrl,
          callbackUrl,
        });
      }
    }

    // Priority 2: static OAuth by URL mapping, or dynamic OAuth fallback
    return this.providerFactory.createProvider({
      serverName,
      serverUrl,
      callbackUrl,
    });
  }

  hasOAuthProvider(serverName: string): boolean {
    return this.oauthProviders.has(serverName);
  }

  hasCatalogItemOAuth(catalogItemId: string): boolean {
    return !!this.catalogManager.getPerCatalogItemOAuth(catalogItemId);
  }

  hasStaticOAuthForUrl(serverUrl: string): boolean {
    return this.providerFactory.hasStaticOAuthForUrl(serverUrl);
  }

  getExistingOAuthProvider(serverName: string): McpxOAuthProviderI | undefined {
    return this.oauthProviders.get(serverName);
  }

  async hasPersistedOAuthTokens(serverName: string): Promise<boolean> {
    const tokens = await this.tokenStore.loadTokens(serverName);
    return tokens !== undefined;
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
    // Sweep expired flows first so a stale state cannot complete or be reused.
    this.cleanupExpiredFlows();
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
