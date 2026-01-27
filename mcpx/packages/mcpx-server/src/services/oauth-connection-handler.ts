import { loggableError } from "@mcpx/toolkit-core/logging";
import { withPolling } from "@mcpx/toolkit-core/time";
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
 * Handles OAuth authentication flows for target server connections
 */
export class OAuthConnectionHandler {
  // Store pending OAuth flows by server name for two-phase completion
  private pendingFlows: Map<string, PendingOAuthFlow> = new Map();

  constructor(
    private oauthSessionManager: OAuthSessionManagerI,
    private extendedClientBuilder: ExtendedClientBuilderI,
    private logger: Logger,
  ) {
    this.logger = logger.child({ component: "OAuthConnectionHandler" });
  }

  /**
   * Tries to connect to a target server using existing OAuth tokens if available,
   * if not available or if they fail, will return `undefined`.
   */
  async safeTryWithExistingTokens(
    targetServer: RemoteTargetServer,
  ): Promise<ExtendedClientI | undefined> {
    const targetServerTypeStr =
      targetServer.type === "sse" ? "SSE" : "StreamableHTTP";

    // Get OAuth provider from session manager (coordinated flow)
    const authProvider = this.oauthSessionManager.getOrCreateOAuthProvider({
      serverName: targetServer.name,
      serverUrl: targetServer.url,
    });

    // Check if we already have valid tokens
    const existingTokens = await authProvider.tokens();
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
      this.logger.info(
        "Existing tokens failed, proceeding with new OAuth flow",
        {
          name: targetServer.name,
          error: loggableError(error),
        },
      );
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
      /** Callback invoked when device flow auto-completes */
      onComplete?: (client: ExtendedClientI) => void | Promise<void>;
    },
  ): Promise<InitiateOAuthResult> {
    const { callbackUrl, onComplete } = options ?? {};
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
   * The caller (TargetClients) is responsible for updating server state on failure.
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
      this.pendingFlows.delete(serverName);
    }
  }

  /**
   * Cancel a pending OAuth flow (cleanup)
   */
  cancelPendingOAuth(serverName: string): boolean {
    const existed = this.pendingFlows.delete(serverName);
    if (existed) {
      this.logger.info("Cancelled pending OAuth flow", { serverName });
    }
    return existed;
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
