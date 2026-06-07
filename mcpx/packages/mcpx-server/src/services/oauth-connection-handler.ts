import { loggableError } from "@mcpx/toolkit-core/logging";
import { withPolling } from "@mcpx/toolkit-core/time";
import {
  UnauthorizedError,
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Logger } from "winston";
import {
  SSETargetServer,
  StreamableHttpTargetServer,
} from "../model/target-servers.js";
import { McpxOAuthProviderI } from "../oauth-providers/model.js";
import { DEVICE_FLOW_COMPLETE } from "../oauth-providers/device-flow.js";
import { OAuthSessionManagerI } from "../server/oauth-session-manager.js";
import { ExtendedClientBuilderI, ExtendedClientI } from "./client-extension.js";
import { buildClient } from "./target-server-connection-factory.js";

const OAUTH_POLLING_INTERVAL_MS = 1000;
const OAUTH_URL_POLLING_MAX_ATTEMPTS = 30;
// Device codes typically expire in 15 minutes, so poll for up to 15 minutes
const DEVICE_FLOW_TIMEOUT_MS = 15 * 60 * 1000;
const DEVICE_FLOW_MAX_POLL_ATTEMPTS = Math.ceil(
  DEVICE_FLOW_TIMEOUT_MS / OAUTH_POLLING_INTERVAL_MS,
);

type RemoteTargetServer = SSETargetServer | StreamableHttpTargetServer;
type RemoteTransport = SSEClientTransport | StreamableHTTPClientTransport;

// Origin (scheme + host) to retry when the URL carries a path, else undefined.
// A path-less URL already hits the root well-known, so there's nothing to add.
function originFallback(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? undefined : parsed.origin;
  } catch {
    return undefined;
  }
}

/**
 * Represents a pending OAuth flow waiting for authorization code
 */
interface PendingOAuthFlow {
  provider: McpxOAuthProviderI;
  transport: RemoteTransport;
  client: Client;
  targetServer: RemoteTargetServer;
  /** For device flows: callback to invoke when auto-completion finishes */
  onComplete?: (client: ExtendedClientI) => void | Promise<void>;
}

/**
 * Result of initiating an OAuth flow
 */
export interface InitiateOAuthResult {
  authorizationUrl: string;
  state: string;
  userCode?: string;
}

/**
 * What to do with a remote server, given existing auth state.
 *  - connected:   stored tokens worked; use this client.
 *  - needs-auth:  OAuth server, no/expired tokens → start a flow.
 *  - unreachable: OAuth server, valid tokens, no response → retry.
 *  - not-oauth:   not an OAuth server → a flow can't help.
 */
export type ExistingAuthVerdict =
  | { kind: "connected"; client: ExtendedClientI }
  | { kind: "needs-auth" }
  | { kind: "unreachable" }
  | { kind: "not-oauth" };

type ProtectedResourceMeta = Awaited<
  ReturnType<typeof discoverOAuthProtectedResourceMetadata>
>;
type AuthorizationServerMeta = Awaited<
  ReturnType<typeof discoverAuthorizationServerMetadata>
>;

// Broken out so tests can stub SDK network calls without module mocking.
export interface OAuthDiscovery {
  discoverOAuthProtectedResourceMetadata: typeof discoverOAuthProtectedResourceMetadata;
  discoverAuthorizationServerMetadata: typeof discoverAuthorizationServerMetadata;
}

const DEFAULT_DISCOVERY: OAuthDiscovery = {
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
};

/**
 * Handles OAuth authentication flows for target server connections
 */
export class OAuthConnectionHandler {
  // Store pending OAuth flows by server name for two-phase completion
  private pendingFlows: Map<string, PendingOAuthFlow> = new Map();
  private discovery: OAuthDiscovery;
  // In-progress initiation per server, reused by concurrent or repeat callers
  // (e.g. reopening after closing the tab) until the flow completes or is cancelled.
  private flows: Map<string, Promise<InitiateOAuthResult>> = new Map();

  constructor(
    private oauthSessionManager: OAuthSessionManagerI,
    private extendedClientBuilder: ExtendedClientBuilderI,
    private logger: Logger,
    discovery: OAuthDiscovery = DEFAULT_DISCOVERY,
  ) {
    this.logger = logger.child({ component: "OAuthConnectionHandler" });
    this.discovery = discovery;
  }

  // True if the server advertises RFC 9728 or RFC 8414 OAuth metadata.
  async probeOAuthSupport(serverUrl: string): Promise<boolean> {
    const { resourceMeta, authMeta } =
      await this.discoverOAuthMetadata(serverUrl);
    return Boolean(resourceMeta) || Boolean(authMeta);
  }

  // Chains auth-server URL from protected-resource metadata when present,
  // per RFC 8414. Both calls are non-fatal.
  private async discoverOAuthMetadata(serverUrl: string): Promise<{
    resourceMeta?: ProtectedResourceMeta;
    authMeta?: AuthorizationServerMeta;
  }> {
    const resourceMeta = await this.discoverOrLog(
      "Protected-resource",
      () => this.discovery.discoverOAuthProtectedResourceMetadata(serverUrl),
      { serverUrl },
    );
    // An RFC 9728 auth-server URL is authoritative. Otherwise the MCP URL's path
    // (e.g. /v1/sse) is a transport endpoint, not an issuer, so also try the bare
    // origin — the well-known URL the SDK skips for path URLs (e.g. Atlassian).
    const candidates = resourceMeta?.authorization_servers?.length
      ? [resourceMeta.authorization_servers[0]]
      : [serverUrl, originFallback(serverUrl)];
    const authMeta = await this.firstAuthMeta(candidates);
    return { resourceMeta, authMeta };
  }

  // First candidate that advertises auth-server metadata; probes are non-fatal.
  private async firstAuthMeta(
    candidates: (string | undefined)[],
  ): Promise<AuthorizationServerMeta | undefined> {
    for (const authServerUrl of candidates) {
      if (!authServerUrl) continue;
      const authMeta = await this.discoverOrLog(
        "Authorization-server",
        () => this.discovery.discoverAuthorizationServerMetadata(authServerUrl),
        { authServerUrl },
      );
      if (authMeta) return authMeta;
    }
    return undefined;
  }

  // Runs a discovery call; on failure logs and resolves to undefined.
  private discoverOrLog<T>(
    what: string,
    call: () => Promise<T>,
    context: Record<string, unknown>,
  ): Promise<T | undefined> {
    return call().catch((error) => {
      this.logger.debug(`${what} metadata discovery failed`, {
        ...context,
        error: loggableError(error),
      });
      return undefined;
    });
  }

  // Returns the connected client on success, undefined otherwise.
  // No-op for servers with no in-session provider and no persisted tokens, so
  // callers can use isOAuthServer afterward to tell "never authed" from
  // "tokens expired". Rehydrates the provider on restart when disk has tokens.
  // On 401: stored tokens are deleted (invalid). On other errors: preserved
  // for the watchdog to retry.
  async safeTryWithExistingTokens(
    targetServer: RemoteTargetServer,
  ): Promise<ExtendedClientI | undefined> {
    const targetServerTypeStr =
      targetServer.type === "sse" ? "SSE" : "StreamableHTTP";

    let authProvider = this.oauthSessionManager.getExistingOAuthProvider(
      targetServer.name,
    );
    if (!authProvider) {
      let hasPersisted: boolean;
      try {
        hasPersisted = await this.oauthSessionManager.hasPersistedOAuthTokens(
          targetServer.name,
        );
      } catch (error) {
        this.logger.info(
          "Could not check persisted tokens, preserving for retry",
          { name: targetServer.name, error: loggableError(error) },
        );
        return undefined;
      }
      if (!hasPersisted) {
        return undefined;
      }
      authProvider = this.oauthSessionManager.getOrCreateOAuthProvider({
        serverName: targetServer.name,
        serverUrl: targetServer.url,
      });
    }

    // Check if we already have valid tokens
    let existingTokens: Awaited<ReturnType<typeof authProvider.tokens>>;
    try {
      existingTokens = await authProvider.tokens();
    } catch (error) {
      this.logger.warn("Failed to read tokens", {
        name: targetServer.name,
        error: loggableError(error),
      });
      return undefined;
    }
    if (!existingTokens) {
      return undefined;
    }
    this.logger.info("Found existing tokens, attempting to use them", {
      name: targetServer.name,
    });

    // Create transport with existing auth provider
    const transport =
      targetServer.type === "sse"
        ? new SSEClientTransport(new URL(targetServer.url), {
            authProvider,
          })
        : new StreamableHTTPClientTransport(new URL(targetServer.url), {
            authProvider,
          });

    // Try to use the existing tokens
    try {
      // If successful, create and return the client
      const client = buildClient(targetServer.name);
      await client.connect(transport);

      const extendedClient = await this.extendedClientBuilder.build({
        name: targetServer.name,
        originalClient: client,
      });

      this.logger.info(
        `${targetServerTypeStr} Client connected with existing OAuth tokens`,
        {
          name: targetServer.name,
          url: targetServer.url,
        },
      );
      return extendedClient;
    } catch (error) {
      if (isAuthenticationError(error)) {
        // Tokens were rejected — delete them so the next attempt triggers a fresh OAuth flow.
        this.logger.info(
          "Existing tokens rejected by server (401), clearing tokens",
          { name: targetServer.name, error: loggableError(error) },
        );
        await this.deleteOAuthTokensForServer(targetServer.name);
      } else {
        // Network / transport error — tokens may still be valid once the server is back.
        this.logger.info(
          "Server unreachable with existing tokens, preserving for retry",
          {
            name: targetServer.name,
            error: loggableError(error),
          },
        );
      }
      return undefined;
    }
  }

  /**
   * Phase 1: Initiate OAuth flow, get authorization URL, return immediately.
   * The server stays in pending-auth state until completeOAuth() is called.
   * This enables non-blocking OAuth flows for both UI and external orchestration.
   *
   * For device flows, an optional `onComplete` callback can be provided.
   * The device flow polling will auto-complete and invoke this callback
   * when the user authorizes the device.
   */
  async initiateOAuth(
    targetServer: RemoteTargetServer,
    options?: {
      callbackUrl?: string;
      /** pending-auth re-auth: clear stale tokens/client_info for fresh DCR. */
      resetStaleTokens?: boolean;
      /** Callback invoked when device flow auto-completes */
      onComplete?: (client: ExtendedClientI) => void | Promise<void>;
    },
  ): Promise<InitiateOAuthResult> {
    // Reuse a live flow instead of opening another tab. If it expired
    // (getOAuthFlow returns undefined) or the in-flight attempt failed, discard
    // and start fresh so a dead URL can never block a new login.
    const existing = this.flows.get(targetServer.name);
    if (existing) {
      const result = await existing.catch(() => null);
      if (result && this.oauthSessionManager.getOAuthFlow(result.state)) {
        this.logger.debug("Reusing existing OAuth flow", {
          name: targetServer.name,
        });
        return result;
      }
      this.cleanupPendingFlow(targetServer.name);
    }

    const flow = this.startOAuthFlow(targetServer, options);
    this.flows.set(targetServer.name, flow);
    // Drop it on failure so a later attempt starts fresh. On success it stays
    // until the flow completes or is cancelled.
    flow.catch(() => {
      if (this.flows.get(targetServer.name) === flow) {
        this.flows.delete(targetServer.name);
      }
    });
    return flow;
  }

  private async startOAuthFlow(
    targetServer: RemoteTargetServer,
    options?: {
      callbackUrl?: string;
      resetStaleTokens?: boolean;
      onComplete?: (client: ExtendedClientI) => void | Promise<void>;
    },
  ): Promise<InitiateOAuthResult> {
    const { callbackUrl, onComplete, resetStaleTokens } = options ?? {};

    if (resetStaleTokens) {
      // Re-auth of a pending-auth server: clear stored tokens and the DCR client
      // registration so we re-register with a fresh client_id. NOT redundant with
      // the 401-delete in safeTryWithExistingTokens. The token-expiry path reaches
      // pending-auth via a local expiry check with no server round-trip, so no 401
      // fires, and a server-side-stale registration would otherwise be reused and
      // rejected (invalid_client), looping forever. Removing this reintroduces that.
      await this.deleteOAuthTokensForServer(targetServer.name);
    } else {
      // Close any prior flow's transport before replacing the entry.
      this.cleanupPendingFlow(targetServer.name);
    }

    const authProvider = this.oauthSessionManager.getOrCreateOAuthProvider({
      serverName: targetServer.name,
      serverUrl: targetServer.url,
      callbackUrl,
    });

    const state = authProvider.state();
    this.oauthSessionManager.startOAuthFlow(
      targetServer.name,
      targetServer.url,
      state,
    );

    this.logger.info("Initiating OAuth flow", {
      name: targetServer.name,
      callbackUrl,
    });

    // Discover auth server metadata and request offline_access if supported,
    // so servers that support refresh tokens will issue one.
    await this.applyDiscoveredScope(targetServer.url, authProvider);

    // Create transport with auth provider - this will trigger OAuth flow
    const transport =
      targetServer.type === "sse"
        ? new SSEClientTransport(new URL(targetServer.url), { authProvider })
        : new StreamableHTTPClientTransport(new URL(targetServer.url), {
            authProvider,
          });

    // Start the transport WITHOUT awaiting - this triggers OAuth flow in the background.
    // The transport will block waiting for auth to complete, but we want to return
    // the authorization URL immediately. The URL is set synchronously in the auth
    // provider's redirectToAuthorization() before it starts waiting for the code.
    transport.start().catch((_e: unknown) => {
      this.logger.debug("expected transport.start() error, continuing");
    });

    if (targetServer.type === "streamable-http") {
      // Hack inspired by `mcp-remote` - also don't await
      const testTransport = new StreamableHTTPClientTransport(
        new URL(targetServer.url),
        { authProvider },
      );
      const testClient = new Client(
        { name: "mcpx-fallback-test", version: "0.0.0" },
        { capabilities: {} },
      );
      testClient.connect(testTransport).catch((_e: unknown) => {
        this.logger.debug(
          "expected client.connect() error on mcpx-fallback-test, continuing",
          { error: loggableError(_e) },
        );
      });
    }

    // Poll for authorization URL (quick, should be available fast)
    const authorizationUrl = await withPolling({
      maxAttempts: OAUTH_URL_POLLING_MAX_ATTEMPTS,
      sleepTimeMs: OAUTH_POLLING_INTERVAL_MS,
      getValue: () => authProvider.getAuthorizationUrl(),
      found: (url): url is URL => Boolean(url),
    });

    if (!authorizationUrl) {
      throw new Error(
        `Failed to obtain authorization URL for server: ${targetServer.name}`,
      );
    }

    // Store for later completion
    const client = buildClient(targetServer.name);
    this.pendingFlows.set(targetServer.name, {
      provider: authProvider,
      transport,
      client,
      targetServer,
      onComplete,
    });

    this.logger.debug("OAuth flow initiated, waiting for authorization", {
      name: targetServer.name,
      state,
    });

    // For device flows, start background polling to auto-complete when user authorizes
    if (authProvider.type === "device_flow") {
      this.startDeviceFlowPoller(targetServer.name);
    }

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
      userCode:
        authProvider.type === "device_flow"
          ? (authProvider.getUserCode() ?? undefined)
          : undefined,
    };
  }

  /**
   * Phase 2: Complete OAuth flow with authorization code.
   * Called when the authorization code is received (via callback or external system).
   *
   * On error, the pending flow is cleaned up and the error is rethrown.
   * The caller (UpstreamHandler) is responsible for updating server state on failure.
   */
  async completeOAuth(
    serverName: string,
    authorizationCode: string,
  ): Promise<ExtendedClientI> {
    const pending = this.pendingFlows.get(serverName);
    if (!pending) {
      throw new Error(`No pending OAuth flow for server: ${serverName}`);
    }

    const { provider, transport, client, targetServer } = pending;

    this.logger.debug("Completing OAuth flow", { serverName });

    try {
      // Complete authorization (resolves the provider's promise)
      provider.completeAuthorization(authorizationCode);

      // Handle device flow differently - tokens are already obtained
      if (
        provider.type === "device_flow" &&
        authorizationCode === DEVICE_FLOW_COMPLETE
      ) {
        this.logger.info("Device flow completed, using saved tokens", {
          name: serverName,
        });

        const freshTransport =
          targetServer.type === "sse"
            ? new SSEClientTransport(new URL(targetServer.url), {
                authProvider: provider,
              })
            : new StreamableHTTPClientTransport(new URL(targetServer.url), {
                authProvider: provider,
              });

        await client.connect(freshTransport);
      } else {
        // Standard OAuth authorization code flow - exchange code for tokens
        await transport.finishAuth(authorizationCode);

        const postAuthTransport =
          targetServer.type === "sse"
            ? new SSEClientTransport(new URL(targetServer.url), {
                authProvider: provider,
              })
            : new StreamableHTTPClientTransport(new URL(targetServer.url), {
                authProvider: provider,
              });

        await client.connect(postAuthTransport);
      }

      const extendedClient = await this.extendedClientBuilder.build({
        name: serverName,
        originalClient: client,
      });

      this.logger.info("OAuth flow completed successfully", {
        name: serverName,
        url: targetServer.url,
      });

      return extendedClient;
    } finally {
      // Live connection runs on the post-auth transport, close the pre-auth one.
      this.cleanupPendingFlow(serverName);
    }
  }

  // Drop the flow entry, release the provider's pending auth (completeAuthorization
  // clears the stale URL, no-op once finished or for device flows), and close the
  // transport, which is started without awaiting and would otherwise leak.
  private cleanupPendingFlow(serverName: string): void {
    this.flows.delete(serverName);
    const pending = this.pendingFlows.get(serverName);
    if (!pending) return;
    this.pendingFlows.delete(serverName);
    pending.provider.completeAuthorization();
    pending.transport.close().catch((e: unknown) => {
      this.logger.debug("Error closing prior OAuth transport", {
        serverName,
        error: loggableError(e),
      });
    });
  }

  /**
   * Cancel a pending OAuth flow (cleanup)
   */
  cancelPendingOAuth(serverName: string): boolean {
    // flows is set before pendingFlows (which is only populated after URL polling),
    // so check both. Otherwise a cancel/delete while the URL is still polling would
    // leave the in-flight flow reusable.
    const existed =
      this.flows.has(serverName) || this.pendingFlows.has(serverName);
    if (existed) {
      this.cleanupPendingFlow(serverName);
      this.logger.info("Cancelled pending OAuth flow", { serverName });
    }
    return existed;
  }

  /**
   * Discovers the auth server's metadata and calls setDiscoveredScope("offline_access")
   * on the provider when the server lists it in scopes_supported.
   * Non-fatal: errors are logged inside discoverOAuthMetadata and the flow
   * continues without the extra scope.
   */
  private async applyDiscoveredScope(
    serverUrl: string,
    provider: McpxOAuthProviderI,
  ): Promise<void> {
    const { authMeta } = await this.discoverOAuthMetadata(serverUrl);
    if (authMeta?.scopes_supported?.includes("offline_access")) {
      provider.setDiscoveredScope("offline_access");
      this.logger.debug("Requested offline_access scope", {
        serverUrl,
        provider: provider.serverName,
      });
    }
  }

  /**
   * Deletes stored OAuth tokens for a server and removes it from the provider cache.
   * Also cancels any pending OAuth flow for the server.
   */
  async deleteOAuthTokensForServer(serverName: string): Promise<void> {
    this.cancelPendingOAuth(serverName);
    await this.oauthSessionManager.deleteOAuthTokensForServer(serverName);
    this.logger.info("Deleted OAuth tokens for server", { serverName });
  }

  /**
   * Start background polling for device flow authorization.
   * Device flows require repeated calls to getAuthorizationCode() to trigger
   * internal token polling. When the user authorizes, the provider returns
   * DEVICE_FLOW_COMPLETE and we auto-complete the OAuth flow.
   */
  private startDeviceFlowPoller(serverName: string): void {
    const startedAt = Date.now();
    let attempts = 0;

    const poll = async (): Promise<void> => {
      const pending = this.pendingFlows.get(serverName);
      if (!pending) {
        // Flow was cancelled or completed externally
        return;
      }

      attempts++;
      if (attempts > DEVICE_FLOW_MAX_POLL_ATTEMPTS) {
        this.logger.warn("Device flow polling timed out", {
          serverName,
          attempts,
          elapsedMs: Date.now() - startedAt,
        });
        this.cancelPendingOAuth(serverName);
        return;
      }

      const code = pending.provider.getAuthorizationCode();
      if (code === DEVICE_FLOW_COMPLETE) {
        this.logger.debug(
          "Device flow authorization detected, auto-completing",
          { serverName },
        );
        try {
          const extendedClient = await this.completeOAuth(
            serverName,
            DEVICE_FLOW_COMPLETE,
          );
          await pending.onComplete?.(extendedClient);
        } catch (error) {
          this.logger.error("Failed to auto-complete device flow", {
            serverName,
            error: loggableError(error),
          });
        }
        return;
      }

      // Schedule next poll attempt
      setTimeout(poll, OAUTH_POLLING_INTERVAL_MS);
    };

    // Start polling (don't await - runs in background)
    poll().catch((error) => {
      this.logger.error("Device flow poller error", {
        serverName,
        error: loggableError(error),
      });
    });
  }

  /**
   * Returns true if the server has an OAuth provider registered
   * (i.e., it has been through OAuth at some point in this session).
   */
  isOAuthServer(serverName: string): boolean {
    return this.oauthSessionManager.hasOAuthProvider(serverName);
  }

  /**
   * Returns true if the server's stored token is expired or missing.
   * Used by the background expiry monitor.
   */
  async isTokenExpiredForServer(
    targetServer: RemoteTargetServer,
  ): Promise<boolean> {
    const provider = this.oauthSessionManager.getExistingOAuthProvider(
      targetServer.name,
    );
    if (!provider) return false;
    try {
      const tokens = await provider.tokens();
      return tokens === undefined;
    } catch (error) {
      this.logger.warn("Failed to read tokens, not treating as expired", {
        name: targetServer.name,
        error: loggableError(error),
      });
      return false;
    }
  }

  // Classifies how to connect a server given existing auth state. Tries stored
  // tokens, then classifies the failure. Caller applies the verdict.
  async resolveExistingAuth(
    targetServer: RemoteTargetServer,
  ): Promise<ExistingAuthVerdict> {
    const client = await this.safeTryWithExistingTokens(targetServer);
    if (client) {
      return { kind: "connected", client };
    }

    // OAuth server if we have a context or it advertises metadata. Probe is a
    // network call, so skip it when we already have context (short-circuit).
    const hasOAuthContext = this.isOAuthServer(targetServer.name);
    const isOAuthServer =
      hasOAuthContext || (await this.probeOAuthSupport(targetServer.url));
    if (!isOAuthServer) {
      return { kind: "not-oauth" };
    }

    // Valid tokens but no response → unreachable, not auth. Gated on context
    // since isTokenExpiredForServer reports false without one.
    if (
      hasOAuthContext &&
      !(await this.isTokenExpiredForServer(targetServer))
    ) {
      return { kind: "unreachable" };
    }

    return { kind: "needs-auth" };
  }

  /**
   * Lookup server name by OAuth state parameter
   */
  getServerNameByState(state: string): string | null {
    const flow = this.oauthSessionManager.getOAuthFlow(state);
    return flow?.serverName ?? null;
  }

  /**
   * Cleanup OAuth flow tracking by state
   */
  completeOAuthFlowCleanup(state: string): void {
    this.oauthSessionManager.completeOAuthFlow(state);
  }
}

/**
 * Checks if an error indicates OAuth authentication is required
 */
export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof UnauthorizedError) {
    return true;
  }
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    return (
      (err?.["response"] as Record<string, unknown>)?.["status"] === 401 ||
      err?.["status"] === 401 ||
      err?.["code"] === 401 ||
      (typeof err?.["message"] === "string" &&
        err["message"].includes("401")) ||
      (typeof err?.["message"] === "string" &&
        err["message"].includes("Unauthorized"))
    );
  }
  return false;
}
