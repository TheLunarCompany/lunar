import { Logger } from "winston";
import { OAuthProviderFactory } from "./oauth-provider-factory.js";
import { McpxOAuthProviderI } from "./oauth-provider.js";
import { env } from "../env.js";

// Time between OAuth flow creation and expiration
// This is not the token expiration time, but the flow state expiration time
const STALENESS_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

export interface OAuthFlowState {
  serverName: string;
  state: string;
  createdAt: Date;
}

export interface OAuthSessionManagerI {
  getOrCreateOAuthProvider(serverName: string): McpxOAuthProviderI;
  startOAuthFlow(serverName: string, state: string): void;
  getOAuthFlow(state: string): OAuthFlowState | undefined;
  completeOAuthFlow(state: string): OAuthFlowState | undefined;
}
/**
 * Manages OAuth sessions for a single user connecting to multiple MCP servers
 */
export class OAuthSessionManager {
  private oauthProviders: Map<string, McpxOAuthProviderI> = new Map();
  private activeFlows: Map<string, OAuthFlowState> = new Map(); // state -> flow info
  private logger: Logger;
  private providerFactory: OAuthProviderFactory;

  constructor(logger: Logger, providerFactory?: OAuthProviderFactory) {
    this.logger = logger;
    this.providerFactory =
      providerFactory ||
      new OAuthProviderFactory(logger, { tokensDir: env.AUTH_TOKENS_DIR });
  }

  /**
   * Gets or creates an OAuth provider for a connection to a specific MCP server
   */
  getOrCreateOAuthProvider(serverName: string): McpxOAuthProviderI {
    let provider = this.oauthProviders.get(serverName);
    if (!provider) {
      provider = this.providerFactory.createProvider(serverName);
      this.oauthProviders.set(serverName, provider);
      this.logger.info("Created OAuth provider for server", {
        serverName,
      });
    }

    return provider;
  }

  /**
   * Starts an OAuth flow and tracks the state
   */
  startOAuthFlow(serverName: string, state: string): void {
    const flowState: OAuthFlowState = {
      serverName,
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
