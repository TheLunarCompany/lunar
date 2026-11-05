// No unit test: this is a god object that interleaves pure decisions, effectful
import { normalizeServerName } from "@mcpx/toolkit-core/data";

// collaborator calls, and timers (setTimeout/setInterval/queueMicrotask), so
// testing any behavior means mocking all ten collaborators and fighting fake
// timers. Behavior is covered by the it/ integration tests for now. To make it
// unit-testable, extract these collaborators and leave this class as wiring:
//   - ReconnectScheduler: reconnectQueue + backoff, behind an injected clock.
//   - ClientStore: _clientsByService + lookups + listChanged subscriptions.
//   - CapabilitySync: performSync, refreshClientCapability, kickoffPromptMessagesFetch.
//   - AuthRecovery: executeWithAuthRetry, handleAuthFailure, checkTokenExpiry.
//   - Pass ENABLE_PROMPT_CAPABILITY/READ_TARGET_SERVERS_FROM_FILE via config
//     instead of reading env inline.
import { makeError, stringifyEq } from "@aigw/core/data";
import { loggableError, TelemetryLogger } from "@aigw/core/logging";
import {
  Prompt,
  PromptMessage,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { ConfigService } from "../config.js";
import { env } from "../env.js";
import { ToolExtensions } from "../model/config/tool-extensions.js";
import {
  CapabilityKind,
  CapabilityRegistry,
  ServerCapabilities,
} from "./capability-registry.js";
import { CapabilityResolver } from "./capability-resolver.js";
import { buildAuthToolDefinition } from "./oauth-tools.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  InvalidSchemaError,
  NotAllowedError,
  NotFoundError,
  TokenExpiredError,
} from "../errors.js";
import { RemoteTargetServer, TargetServer } from "../model/target-servers.js";
import { CatalogChange, CatalogManagerI } from "./catalog-manager.js";
import {
  ExtendedClientI,
  isTransportError,
  PingOutcome,
} from "./client-extension.js";
import {
  fetchPromptCapabilities,
  fetchPromptMessages,
  fetchToolCapabilities,
} from "./fetch-capabilities.js";
import { sanitizeTargetServerForTelemetry } from "./control-plane-service.js";
import {
  InitiateOAuthResult,
  isAuthenticationError,
  OAuthConnectionHandler,
} from "./oauth-connection-handler.js";
import { ServerConfigManager } from "./server-config-manager.js";
import {
  SystemStateTracker,
  TargetServerNewWithoutUsage,
} from "./system-state.js";
import { TargetServerConnectionFactory } from "./target-server-connection-factory.js";
import { ToolTokenEstimator } from "./tool-token-estimator.js";
import {
  buildSystemStatePromptsPayload,
  buildSystemStateToolsPayload,
  prepareForSystemState,
} from "./prepare-for-system-state.js";
import {
  TargetClient,
  ConnectedTargetClient,
  ConnectingTargetClient,
  PendingAuthTargetClient,
  isConnected,
  isConnectionFailed,
  isConnecting,
  isPendingAuth,
} from "./target-client-types.js";
import {
  TargetClientConnector,
  TargetClientUpsert,
} from "./target-client-connector.js";
import { UpstreamWatchdog } from "./upstream-watchdog.js";

export interface UpstreamHandlerConfig {
  pingIntervalMs: number;
  pingTimeoutMs: number;
  pingFailureThreshold: number;
  reconnectBaseDelayMs: number;
}

// Caps the per-attempt wait so we retry at least once per hour indefinitely.
const MAX_RECONNECT_DELAY_MS = 60 * 60 * 1000;

export interface TargetServerChangeNotifier {
  registerPostChangeHook(
    hookName: string,
    hook: (servers: TargetServer[]) => void,
  ): void;
}

export interface UpstreamHandlerOAuthHandler {
  initiateOAuthForServer(
    targetServerName: string,
    callbackUrl?: string,
  ): Promise<InitiateOAuthResult>;
}

function sameStringSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

type RemoteConnectedTargetClient = ConnectedTargetClient & {
  targetServer: RemoteTargetServer;
};

function hasRemoteTargetServer(
  client: ConnectedTargetClient,
): client is RemoteConnectedTargetClient {
  return (
    client.targetServer.type === "sse" ||
    client.targetServer.type === "streamable-http"
  );
}

// Capabilities live in CapabilityRegistry, so the stored client drops them.
function storedClient(upsert: TargetClientUpsert): TargetClient {
  if (!isConnected(upsert)) return upsert;
  return {
    _state: "connected",
    targetServer: upsert.targetServer,
    extendedClient: upsert.extendedClient,
  };
}

// This class manages connections to upstream MCP servers, via initializing
// `Client` instances, extending them into `ExtendedClient` instances,
// storing them in a map, and providing methods to add, remove, and list clients.
export class UpstreamHandler
  implements TargetServerChangeNotifier, UpstreamHandlerOAuthHandler
{
  private _clientsByService: Map<string, TargetClient> = new Map();
  private targetServers: TargetServer[] = [];
  private initialized = false;
  private tokenExpiryInterval: NodeJS.Timeout | null = null;
  private postChangeHooks = new Map<
    string,
    (servers: TargetServer[]) => void
  >();
  private authRecoveryByService: Map<
    string,
    Promise<ConnectedTargetClient | null>
  > = new Map();
  private readonly listChangedUnsubscribers: Record<
    CapabilityKind,
    Map<string, () => void>
  > = {
    tools: new Map(),
    prompts: new Map(),
    resources: new Map(), // unused: resources are currently local, not upstream
  };
  private _watchdog: UpstreamWatchdog;
  // Connection attempts run here and cannot record state, so the stale check
  // in attemptReconnect covers every outcome.
  private readonly connector: TargetClientConnector;
  private readonly reconnectQueue = new Map<string, NodeJS.Timeout>();
  private readonly reconnectsInFlight = new Map<string, Promise<void>>();
  private readonly reconnectAttemptsByServer = new Map<string, number>();
  private readonly reconnectBaseDelayMs: number;
  private shuttingDown = false;
  private previousToolExtensions: ToolExtensions["services"] = {};
  private unsubscribeConfig?: () => void;

  constructor(
    private systemState: SystemStateTracker,
    private serverConfigManager: ServerConfigManager,
    connectionFactory: TargetServerConnectionFactory,
    private oauthConnectionHandler: OAuthConnectionHandler,
    private catalogManager: CatalogManagerI,
    private toolTokenEstimator: ToolTokenEstimator,
    private capabilityRegistry: CapabilityRegistry,
    private capabilityResolver: CapabilityResolver,
    private configService: ConfigService,
    private logger: TelemetryLogger,
    config: UpstreamHandlerConfig,
  ) {
    this.logger = logger.child({ component: "UpstreamHandler" });
    this.reconnectBaseDelayMs = config.reconnectBaseDelayMs;
    this.connector = new TargetClientConnector(
      connectionFactory,
      oauthConnectionHandler,
      catalogManager,
      (serverName) =>
        this.reconnectAttemptsByServer.get(normalizeServerName(serverName)) ??
        0,
      this.logger,
    );
    this._watchdog = new UpstreamWatchdog(
      {
        pingServer: (name): Promise<PingOutcome> =>
          this.pingServer(name, config.pingTimeoutMs),
        onServerUnreachable: (name, error): Promise<void> =>
          this.onServerUnreachable(name, error),
      },
      config,
      this.logger,
    );
  }

  private async refreshClientTools(
    name: string,
    client: ConnectedTargetClient,
  ): Promise<void> {
    await this.refreshClientCapability("tools", name, client, (ec) =>
      fetchToolCapabilities(ec),
    );
  }

  private async refreshClientPrompts(
    name: string,
    client: ConnectedTargetClient,
  ): Promise<void> {
    if (!env.ENABLE_PROMPT_CAPABILITY) return;
    const ok = await this.refreshClientCapability(
      "prompts",
      name,
      client,
      (ec) => fetchPromptCapabilities(ec),
    );
    // Registry already pruned previews for any dropped prompts; kickoff fills
    // in previews for prompts still missing one. Both no-op when nothing
    // changed, so this is cheap to call on every refresh.
    if (ok) void this.kickoffPromptMessagesFetch(name, client);
  }

  // Fetcher returns a partial registry entry for `kind`; merged with the
  // existing entry so refreshing prompts doesn't clobber tools and vice versa.
  // Returns false on fetch/identity failure.
  private async refreshClientCapability(
    kind: CapabilityKind,
    name: string,
    client: ConnectedTargetClient,
    fetcher: (ec: ExtendedClientI) => Promise<Partial<ServerCapabilities>>,
  ): Promise<boolean> {
    try {
      const update = await this.executeWithAuthRetry(
        client,
        `list${kind === "tools" ? "Tools" : "Prompts"}`,
        fetcher,
      );
      // Identity check, not null-check — reconnect swaps the map entry.
      const refreshedClient = this.getConnectedClientByName(name);
      if (!refreshedClient || refreshedClient !== client) return false;
      const normalizedName = normalizeServerName(name);
      const existing = this.capabilityRegistry.servers.get(normalizedName);
      this.capabilityRegistry.registerServer(normalizedName, {
        ...existing,
        ...update,
      });
      this.notifyPostChangeHooks();
      // Explicit sync: resolver only notifies on approved-set changes,
      // not on raw originalTools/originalPrompts movement.
      this.syncSystemStateWithApprovals();
      this.logger.debug(`Refreshed ${kind} for client`, { name });
      return true;
    } catch (e) {
      this.logger.error(`Failed to refresh ${kind} for client`, {
        name,
        error: loggableError(e),
      });
      return false;
    }
  }

  get servers(): TargetServer[] {
    return this.targetServers;
  }

  registerPostChangeHook(
    hookName: string,
    hook: (servers: TargetServer[]) => void,
  ): void {
    if (this.postChangeHooks.has(hookName)) {
      this.logger.warn("Replacing existing post change hook", { hookName });
    }
    this.postChangeHooks.set(hookName, hook);
  }

  async initialize(): Promise<void> {
    if (env.READ_TARGET_SERVERS_FROM_FILE) {
      try {
        this.targetServers = this.serverConfigManager.readTargetServers();
        if (this.targetServers.length > 0) {
          const telemetryServers = Object.fromEntries(
            this.targetServers.map((server) => [
              server.name,
              sanitizeTargetServerForTelemetry(server),
            ]),
          );
          this.logger.telemetry.info("target servers loaded", {
            mcpServers: telemetryServers,
          });
        }
        // Clear any previous config error on successful load
        this.systemState.clearConfigError();
      } catch (e) {
        if (e instanceof InvalidSchemaError) {
          // Log the error and set config error in system state
          this.logger.error("Configuration validation failed", {
            error: e.message,
          });
          this.systemState.setConfigError(e.message);
          this.targetServers = [];
        }
      }
    }
    this.logger.info("Initializing UpstreamHandler with servers", {
      count: this.targetServers.length,
    });
    await this.reloadClients();
    this.logger.info("UpstreamHandler initialized", {
      count: this._clientsByService.size,
    });
    this.initialized = true;
    this.startTokenExpiryMonitor();
    this.catalogManager.subscribe((change) => this.onCatalogChange(change));

    // Refresh on toolExtensions change — upstream won't notify since
    // extensions originate in our own config.
    this.previousToolExtensions =
      this.configService.getConfig().toolExtensions.services;
    this.unsubscribeConfig = this.configService.subscribe(({ config }) => {
      const next = config.toolExtensions.services;
      const prev = this.previousToolExtensions;
      this.previousToolExtensions = next;
      this.onToolExtensionsChanged(prev, next);
    });
  }

  private onToolExtensionsChanged(
    prev: ToolExtensions["services"],
    next: ToolExtensions["services"],
  ): void {
    const allNames = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const name of allNames) {
      if (stringifyEq(prev[name], next[name])) continue;
      const normalizedName = normalizeServerName(name);
      const client = this._clientsByService.get(normalizedName);
      if (!client || !isConnected(client)) continue;
      void this.refreshClientTools(normalizedName, client).catch((error) => {
        this.logger.error(
          "Failed to refresh tools after toolExtensions change",
          { name: normalizedName, error: loggableError(error) },
        );
      });
    }
  }

  private async onCatalogChange(change: CatalogChange): Promise<void> {
    for (const serverName of change.removedServers) {
      if (this._clientsByService.has(normalizeServerName(serverName))) {
        this.logger.info("Disconnecting server removed from catalog", {
          serverName,
        });
        await this.removeClient(serverName);
      }
    }

    if (change.strictnessChanged) {
      for (const [normalizedName] of [...this._clientsByService.entries()]) {
        if (!this.catalogManager.isServerApproved(normalizedName)) {
          this.logger.info(
            "Removing unapproved server after strictness change",
            { serverName: normalizedName },
          );
          await this.removeClient(normalizedName);
        }
      }
    }
  }

  // Microtask-coalesced so a batch of resolver recomputes pays for one sync.
  syncSystemStateWithApprovals(): void {
    if (this.systemStateSyncScheduled) return;
    this.systemStateSyncScheduled = true;
    queueMicrotask(() => {
      this.systemStateSyncScheduled = false;
      this.performSync();
    });
  }

  private systemStateSyncScheduled = false;

  private performSync(): void {
    // approved* drops admin-inactive servers; original* keeps raw upstream.
    for (const [normalizedName, entry] of this.capabilityRegistry.servers) {
      const client = this._clientsByService.get(normalizedName);
      if (!client) continue;
      const approvedTools =
        this.capabilityResolver.getApprovedToolsForServer(normalizedName);
      const rawTools = (entry.tools ?? [])
        .filter((t) => t.origin === "upstream")
        .map((t) => t.definition);
      this.systemState.updateTargetServerTools({
        name: client.targetServer.name,
        ...buildSystemStateToolsPayload(approvedTools, rawTools, (tool) =>
          this.toolTokenEstimator.estimateTokens(tool),
        ),
      });

      const approvedPrompts =
        this.capabilityResolver.getApprovedPromptsForServer(normalizedName);
      const rawPrompts = (entry.prompts ?? [])
        .filter((p) => p.origin === "upstream")
        .map((p) => p.definition);
      this.systemState.updateTargetServerPrompts({
        name: client.targetServer.name,
        ...buildSystemStatePromptsPayload(
          approvedPrompts,
          rawPrompts,
          entry.promptMessages,
        ),
      });
    }
  }

  get clientsByService(): Map<string, TargetClient> {
    if (!this.initialized) {
      throw new Error("UpstreamHandler not initialized");
    }
    return this._clientsByService;
  }

  private connectedClientsByService(): Map<string, ExtendedClientI> {
    const connectedClients = new Map<string, ExtendedClientI>();
    for (const [serviceName, client] of this._clientsByService.entries()) {
      if (isConnected(client)) {
        connectedClients.set(serviceName, client.extendedClient);
      }
    }
    return connectedClients;
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down UpstreamHandler...");
    this.shuttingDown = true;

    for (const timeout of this.reconnectQueue.values()) {
      clearTimeout(timeout);
    }
    this.reconnectQueue.clear();

    this._watchdog.shutdown();

    if (this.tokenExpiryInterval) {
      clearInterval(this.tokenExpiryInterval);
      this.tokenExpiryInterval = null;
    }

    for (const map of Object.values(this.listChangedUnsubscribers)) {
      for (const unsub of map.values()) unsub();
      map.clear();
    }

    this.unsubscribeConfig?.();
    this.unsubscribeConfig = undefined;

    for (const [name, client] of this.connectedClientsByService()) {
      try {
        await client.close();
        this.logger.info("Client closed", { name });
      } catch (e: unknown) {
        const error = loggableError(e);
        this.logger.error("Error closing client", { name, error });
      }
    }
  }

  getTargetServer(name: string): TargetServer | undefined {
    if (!this.initialized) {
      throw new Error("UpstreamHandler not initialized");
    }
    const normalizedName = normalizeServerName(name);
    const server = this.targetServers.find(
      (server) => normalizeServerName(server.name) === normalizedName,
    );
    if (server && !server.catalogItemId) {
      // try to find if the server matches a catalog server and we get retrieve it's Id
      const matchingCatalogItem = this.catalogManager
        .getCatalog()
        .find((item) => normalizeServerName(item.name) === normalizedName);
      if (matchingCatalogItem) {
        return { ...server, catalogItemId: matchingCatalogItem.id };
      }
    }
    return server;
  }

  async listTools(
    serviceName: string,
  ): ReturnType<ExtendedClientI["listTools"]> {
    const client = this.getConnectedClientByName(serviceName);
    if (!client) {
      throw new NotFoundError(
        `Target server not found or not connected: ${serviceName}`,
      );
    }
    return await this.executeWithAuthRetry(client, "listTools", (extended) =>
      extended.listTools(),
    );
  }

  async callTool(
    serviceName: string,
    params: Parameters<ExtendedClientI["callTool"]>[0],
  ): ReturnType<ExtendedClientI["callTool"]> {
    return this.proxyToUpstream(serviceName, "callTool", (extended) =>
      extended.callTool(params),
    );
  }

  async getPrompt(
    serviceName: string,
    params: Parameters<ExtendedClientI["getPrompt"]>[0],
  ): ReturnType<ExtendedClientI["getPrompt"]> {
    return this.proxyToUpstream(serviceName, "getPrompt", (extended) =>
      extended.getPrompt(params),
    );
  }

  private proxyToUpstream<T>(
    serviceName: string,
    method: string,
    action: (extended: ExtendedClientI) => Promise<T>,
  ): Promise<T> {
    const client = this.requireConnectedClient(serviceName);
    return this.executeWithAuthRetry(client, method, action);
  }

  // Throws TokenExpiredError for OAuth pending-auth (agent signal to re-auth),
  // NotFoundError otherwise.
  private requireConnectedClient(serviceName: string): ConnectedTargetClient {
    const client = this.getConnectedClientByName(serviceName);
    if (client) return client;
    const pendingClient = this._clientsByService.get(
      normalizeServerName(serviceName),
    );
    if (
      pendingClient &&
      isPendingAuth(pendingClient) &&
      this.isOAuthServer(serviceName)
    ) {
      throw new TokenExpiredError(serviceName);
    }
    throw new NotFoundError(
      `Target server not found or not connected: ${serviceName}`,
    );
  }

  async removeClient(name: string): Promise<void> {
    this._watchdog.unwatch(name);
    this.cancelReconnect(name);
    this.logger.info("Attempting to remove client", { name });
    const normalizedName = normalizeServerName(name);
    const client = this._clientsByService.get(normalizedName);
    if (!client) {
      this.logger.debug("Client already removed", { name });
      return;
    }
    try {
      if (isConnected(client)) {
        await client.extendedClient.close();
      }
      // Delete OAuth tokens for remote servers so they don't persist after removal
      if (client.targetServer.type !== "stdio") {
        await this.oauthConnectionHandler
          .deleteOAuthTokensForServer(name)
          .catch((e) => {
            this.logger.warn(
              "Failed to delete OAuth tokens during server removal",
              { name, error: loggableError(e) },
            );
          });
      }
      // Remove from targetServers and persist
      this.targetServers = this.targetServers.filter(
        (server) => normalizeServerName(server.name) !== normalizedName,
      );
      this.serverConfigManager.writeTargetServers(this.targetServers);
      this.recordClientRemoved(name);
      this.logger.info("Client removed", { name });
    } catch (e: unknown) {
      const error = loggableError(e);
      this.logger.error("Error removing client", { name, error });
    }
  }

  async addClient(targetServer: TargetServer): Promise<void> {
    this.logger.info("Attempting to add client", { name: targetServer.name });
    if (!this.catalogManager.isServerApproved(targetServer.name)) {
      this.logger.warn("Attempted to add unapproved server", {
        name: targetServer.name,
      });
      return Promise.reject(
        new NotAllowedError(`Server "${targetServer.name}" is not in catalog`),
      );
    }
    if (this._clientsByService.has(normalizeServerName(targetServer.name))) {
      this.logger.warn("Client name already exists", {
        name: targetServer.name,
      });
      return Promise.reject(
        new AlreadyExistsError(`Server "${targetServer.name}" already exists`),
      );
    }

    // Add to targetServers
    this.targetServers.push(targetServer);

    // Immediately record "connecting" state so UI sees the server right away
    await this.recordClientUpsert({ _state: "connecting", targetServer });

    const client = await this.connector.connect(targetServer);
    this.serverConfigManager.writeTargetServers(this.targetServers);
    await this.recordClientUpsert(client);
    if (isConnectionFailed(client)) {
      this.enqueueReconnect(targetServer.name);
    }
    this.logger.info("Client added", { name: targetServer.name });
  }

  async reloadClients(): Promise<void> {
    // Disconnect all clients before reloading
    await Promise.all(
      Array.from(this.connectedClientsByService().entries()).map(
        async ([name, client]) => {
          return client
            .close()
            .then(() => {
              this.recordClientRemoved(name);
              this.logger.info("Client closed", { name });
            })
            .catch((e: unknown) => {
              const error = loggableError(e);
              this.logger.error("Error closing client", {
                name,
                error,
              });
            });
        },
      ),
    );
    // Record all servers as "connecting" immediately so UI sees them
    await Promise.all(
      this.targetServers.map((server) =>
        this.recordClientUpsert({ _state: "connecting", targetServer: server }),
      ),
    );
    // Now attempt actual connections
    await Promise.all(
      this.targetServers.map(async (server) => {
        const client = await this.connector.connect(server);
        if (!client) return;
        await this.recordClientUpsert(client);
        if (isConnectionFailed(client)) {
          this.enqueueReconnect(server.name);
        }
      }),
    );
  }

  // A method to reuse existing OAuth tokens if available.
  // Will throw an error if the target server is not in pendingAuth state or
  // if reusing tokens fails (missing/rejected tokens)
  async reuseOAuthByName(targetServerName: string): Promise<ExtendedClientI> {
    const pendingAuth = await this.getPendingAuthClient(targetServerName);
    return await this.reuseOAuth(pendingAuth);
  }

  /**
   * Initiates an OAuth flow for the given server, working regardless of its current
   * state (pending-auth for first-time auth, or connected for proactive re-auth).
   * For device flows, auto-completion registers the client when the user authorizes.
   */
  async initiateOAuthForServer(
    targetServerName: string,
    callbackUrl?: string,
  ): Promise<InitiateOAuthResult> {
    const normalizedName = normalizeServerName(targetServerName);
    const client = this._clientsByService.get(normalizedName);
    if (!client) {
      throw new NotFoundError(`Server not found: ${targetServerName}`);
    }
    const targetServer = client.targetServer;
    if (
      targetServer.type !== "sse" &&
      targetServer.type !== "streamable-http"
    ) {
      throw new NotAllowedError(
        `Server ${targetServerName} does not support OAuth authentication`,
      );
    }

    const onComplete = async (
      extendedClient: ExtendedClientI,
    ): Promise<void> => {
      await this.recordClientUpsert(
        await this.connector.finalize(targetServer, extendedClient),
      );
    };
    // initiateOAuth dedupes per server, so repeat or concurrent calls reuse the
    // same flow instead of opening another tab.
    return this.oauthConnectionHandler.initiateOAuth(targetServer, {
      callbackUrl,
      onComplete,
      resetStaleTokens: isPendingAuth(client),
    });
  }

  /** Returns true if the server has an active OAuth provider this session. */
  isOAuthServer(serverName: string): boolean {
    return this.oauthConnectionHandler.isOAuthServer(serverName);
  }

  /**
   * Phase 2: Complete OAuth flow for a pending-auth server with authorization code.
   * Transitions server from pending-auth to connected (or connection-failed if
   * capabilities fail to load). A failed sign-in keeps the server's state.
   * Complete OAuth flow using the OAuth state parameter.
   * This is the main entry point for OAuth callbacks - handles state lookup,
   * connection completion, and cleanup in one call.
   */
  async completeOAuthByState(state: string, code: string): Promise<void> {
    const serverName = this.oauthConnectionHandler.getServerNameByState(state);
    if (!serverName) {
      throw new NotFoundError(`No OAuth flow found for state: ${state}`);
    }

    try {
      await this.completeOAuthForServer(serverName, code);
    } finally {
      this.oauthConnectionHandler.completeOAuthFlowCleanup(state);
    }
  }

  private async completeOAuthForServer(
    targetServerName: string,
    authorizationCode: string,
  ): Promise<void> {
    const client = this._clientsByService.get(
      normalizeServerName(targetServerName),
    );
    if (!client) {
      throw new NotFoundError(`Server not found: ${targetServerName}`);
    }
    const { targetServer } = client;
    if (
      targetServer.type !== "sse" &&
      targetServer.type !== "streamable-http"
    ) {
      return; // unreachable: OAuth flows are only created for remote servers
    }

    try {
      const extendedClient = await this.oauthConnectionHandler.completeOAuth(
        targetServerName,
        authorizationCode,
      );

      this.logger.info("OAuth connection established", { targetServerName });

      const newTargetClient = await this.connector.finalize(
        targetServer,
        extendedClient,
      );
      await this.recordClientUpsert(newTargetClient);
    } catch (e) {
      // A failed sign-in says nothing about the stored tokens, so the server
      // keeps its state. The flow cleared them only if it started from
      // pending-auth, and then the server is still pending-auth. From any other
      // state they may still work, and a queued reconnect still uses them.
      const error = makeError(e);
      this.logger.error("Failed to complete OAuth, keeping the server state", {
        targetServerName,
        state: this._clientsByService.get(normalizeServerName(targetServerName))
          ?._state,
        error: loggableError(error),
      });
      throw error;
    }
  }

  // An internal method that reuses OAuth tokens for a given pendingAuth client.
  private async reuseOAuth(
    pendingAuth: PendingAuthTargetClient,
  ): Promise<ExtendedClientI> {
    const reuse = await this.oauthConnectionHandler.safeTryWithExistingTokens(
      pendingAuth.targetServer,
    );
    if (reuse.kind !== "connected") {
      this.logger.info("Could not reuse possible OAuth tokens", {
        targetServerName: pendingAuth.targetServer.name,
        reason: reuse.kind,
      });
      // TODO: Add a more specific error message here
      return Promise.reject(new FailedToConnectToTargetServer());
    }
    const extendedClient = reuse.client;
    this.logger.info("OAuth connection established", {
      targetServerName: pendingAuth.targetServer.name,
    });
    // Update the clientsByService map - this will replace the pendingAuth entry
    const newTargetClient = await this.connector.finalize(
      pendingAuth.targetServer,
      extendedClient,
    );
    await this.recordClientUpsert(newTargetClient);
    return extendedClient;
  }

  // A method to record state about new client or update existing client.
  // Will update both the internal map and the system state tracker.
  // Returns the client as stored.
  private async recordClientUpsert(
    upsert: TargetClientUpsert,
  ): Promise<TargetClient> {
    const newTargetClient = storedClient(upsert);
    const normalizedName = normalizeServerName(
      newTargetClient.targetServer.name,
    );

    this.dropListChangedSubscriptions(normalizedName);

    this._clientsByService.set(normalizedName, newTargetClient);
    // Same synchronous step as the commit, so no tool call sees the tools of a
    // client that isn't connected, and a result the caller discards (a stale
    // reconnect) never reaches the registry.
    if (isConnected(upsert)) {
      this.capabilityRegistry.registerServer(
        normalizedName,
        upsert.capabilities,
      );
    }

    if (isConnected(newTargetClient) || isPendingAuth(newTargetClient)) {
      this.cancelReconnect(newTargetClient.targetServer.name);
      this.reconnectAttemptsByServer.delete(normalizedName);
    }
    if (isConnected(newTargetClient)) {
      const serverName = newTargetClient.targetServer.name;
      const ec = newTargetClient.extendedClient;
      this.listChangedUnsubscribers.tools.set(
        normalizedName,
        ec.onToolsListChanged(() =>
          this.onUpstreamListChanged("tools", serverName),
        ),
      );
      if (env.ENABLE_PROMPT_CAPABILITY) {
        this.listChangedUnsubscribers.prompts.set(
          normalizedName,
          ec.onPromptsListChanged(() =>
            this.onUpstreamListChanged("prompts", serverName),
          ),
        );
      }
      this._watchdog.watch(newTargetClient.targetServer.name);
      void this.kickoffPromptMessagesFetch(serverName, newTargetClient);
    } else if (isPendingAuth(newTargetClient)) {
      // Surface the auth tool so the agent can call it to complete OAuth even
      // before the upstream tools are reachable.
      this.capabilityRegistry.registerServer(normalizedName, {
        tools: [
          {
            definition: buildAuthToolDefinition(normalizedName),
            origin: "internal",
          },
        ],
      });
    } else if (!isConnecting(newTargetClient)) {
      this.capabilityRegistry.unregisterServer(normalizedName);
    }

    const displayName = newTargetClient.targetServer.catalogItemId
      ? this.catalogManager.getDisplayNameById(
          newTargetClient.targetServer.catalogItemId,
        )
      : this.catalogManager.getDisplayNameByName(
          newTargetClient.targetServer.name,
        );

    // Approvals are discarded for "connecting" state; skip the lookup.
    const skipApprovals = isConnecting(newTargetClient);
    const approvedTools = skipApprovals
      ? []
      : this.capabilityResolver.getApprovedToolsForServer(normalizedName);
    const approvedPrompts = skipApprovals
      ? []
      : this.capabilityResolver.getApprovedPromptsForServer(normalizedName);
    const registryEntry = isConnected(newTargetClient)
      ? this.capabilityRegistry.servers.get(normalizedName)
      : undefined;
    const upstreamTools = (registryEntry?.tools ?? [])
      .filter((t) => t.origin === "upstream")
      .map((t) => t.definition);
    const upstreamPrompts = (registryEntry?.prompts ?? [])
      .filter((p) => p.origin === "upstream")
      .map((p) => p.definition);
    const systemStateTargetServer = this.prepareForSystemState(
      newTargetClient,
      approvedTools,
      upstreamTools,
      approvedPrompts,
      upstreamPrompts,
      registryEntry?.promptMessages,
      displayName,
    );
    this.systemState.recordTargetServerConnection(systemStateTargetServer);

    if (!isConnecting(newTargetClient)) {
      this.notifyPostChangeHooks();
    }
    return newTargetClient;
  }

  // promptMessages isn't an ActiveCapability, so the resolver diff won't fire
  // for it — this path syncs system-state explicitly. Returns the promise so
  // callers can await completion; call sites void it to fire-and-forget.
  private kickoffPromptMessagesFetch(
    name: string,
    client: ConnectedTargetClient,
  ): Promise<void> {
    if (!env.ENABLE_PROMPT_CAPABILITY) return Promise.resolve();
    const normalizedName = normalizeServerName(name);
    const entry = this.capabilityRegistry.servers.get(normalizedName);
    const upstreamPrompts = (entry?.prompts ?? [])
      .filter((p) => p.origin === "upstream")
      .map((p) => p.definition);
    // Only fetch previews we don't already have cached, so a list-changed
    // refresh re-fetches just the new prompts, not the whole set.
    const missing = upstreamPrompts.filter(
      (p) => !entry?.promptMessages?.[p.name],
    );
    if (missing.length === 0) return Promise.resolve();
    const initialNames = new Set(upstreamPrompts.map((p) => p.name));

    return fetchPromptMessages(client.extendedClient, missing, this.logger)
      .then((messages) => {
        const refreshed = this.getConnectedClientByName(name);
        if (!refreshed || refreshed !== client) return;
        // Stale: a later refresh changed the prompt set; drop this result.
        if (
          !sameStringSet(initialNames, this.upstreamPromptNames(normalizedName))
        )
          return;
        const currentEntry =
          this.capabilityRegistry.servers.get(normalizedName);
        this.capabilityRegistry.registerServer(normalizedName, {
          ...currentEntry,
          promptMessages: {
            ...currentEntry?.promptMessages,
            ...messages,
          },
        });
        this.syncSystemStateWithApprovals();
      })
      .catch((e) => {
        this.logger.warn("Background prompt-messages fetch failed", {
          name,
          error: loggableError(e),
        });
      });
  }

  private upstreamPromptNames(normalizedName: string): Set<string> {
    return new Set(
      (this.capabilityRegistry.servers.get(normalizedName)?.prompts ?? [])
        .filter((p) => p.origin === "upstream")
        .map((p) => p.definition.name),
    );
  }

  private recordClientRemoved(name: string): void {
    const normalizedName = normalizeServerName(name);
    this.dropListChangedSubscriptions(normalizedName);
    this._watchdog.unwatch(name);
    this.cancelReconnect(name);
    this.reconnectAttemptsByServer.delete(normalizedName);
    this._clientsByService.delete(normalizedName);
    this.capabilityRegistry.unregisterServer(normalizedName);
    this.systemState.recordTargetServerDisconnected({ name });
    this.notifyPostChangeHooks();
  }

  private onUpstreamListChanged(kind: CapabilityKind, name: string): void {
    const client = this.getConnectedClientByName(name);
    if (!client) return;
    const refresh =
      kind === "tools"
        ? this.refreshClientTools(name, client)
        : this.refreshClientPrompts(name, client);
    void refresh.catch((error) => {
      this.logger.error(
        `Failed to refresh ${kind} after upstream notification`,
        {
          name,
          error: loggableError(error),
        },
      );
    });
  }

  private dropListChangedSubscriptions(normalizedName: string): void {
    for (const map of Object.values(this.listChangedUnsubscribers)) {
      map.get(normalizedName)?.();
      map.delete(normalizedName);
    }
  }

  private async pingServer(
    name: string,
    timeoutMs: number,
  ): Promise<PingOutcome> {
    const client = this.getConnectedClientByName(name);
    if (!client) return "no-signal";
    return client.extendedClient.isAlive(timeoutMs);
  }

  private async onServerUnreachable(
    name: string,
    lastError: Error,
  ): Promise<void> {
    const normalizedName = normalizeServerName(name);
    const existing = this._clientsByService.get(normalizedName);
    if (!existing) return;

    if (isConnected(existing)) {
      existing.extendedClient.close().catch((e) => {
        this.logger.warn("Failed to close client during reconnect", {
          name,
          error: loggableError(e),
        });
      });
    }

    // Show as failed — server is known to be down, not in the middle of connecting
    await this.recordClientUpsert({
      _state: "connection-failed",
      targetServer: existing.targetServer,
      error: lastError,
    });
    this.enqueueReconnect(name);
  }

  private enqueueReconnect(name: string): void {
    // A reconnect already in flight during shutdown must not reschedule itself.
    if (this.shuttingDown) return;
    this._watchdog.unwatch(name);
    this.cancelReconnect(name);
    const normalizedName = normalizeServerName(name);
    const attempts = this.reconnectAttemptsByServer.get(normalizedName) ?? 0;
    const delay = this.reconnectDelay(attempts);
    this.logger.debug("Scheduling upstream server reconnect", {
      name,
      delay,
      attempts,
    });
    const timeout = setTimeout(() => {
      this.reconnectQueue.delete(normalizedName);
      const run = this.runReconnect(name)
        .catch((error) => {
          this.logger.warn("Upstream server reconnect failed", {
            name,
            error: loggableError(error),
          });
        })
        .finally(() => {
          if (this.reconnectsInFlight.get(normalizedName) === run) {
            this.reconnectsInFlight.delete(normalizedName);
          }
        });
      this.reconnectsInFlight.set(normalizedName, run);
    }, delay);
    this.reconnectQueue.set(normalizedName, timeout);
  }

  // Read-only views of the reconnect loop, so a caller can tell "nothing more
  // will happen" without waiting for a timer that should never fire.
  isReconnectQueued(name: string): boolean {
    return this.reconnectQueue.has(normalizeServerName(name));
  }

  async reconnectSettled(name: string): Promise<void> {
    await this.reconnectsInFlight.get(normalizeServerName(name));
  }

  private cancelReconnect(name: string): void {
    const normalizedName = normalizeServerName(name);
    const timeout = this.reconnectQueue.get(normalizedName);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      this.reconnectQueue.delete(normalizedName);
    }
  }

  private reconnectDelay(attempts: number): number {
    // 2 ** attempts overflows to Infinity after ~1024 attempts; Math.min caps it correctly.
    return Math.min(
      this.reconnectBaseDelayMs * 2 ** attempts,
      MAX_RECONNECT_DELAY_MS,
    );
  }

  private async runReconnect(name: string): Promise<void> {
    const shouldRetry = await this.attemptReconnect(name);
    if (shouldRetry) {
      const normalizedName = normalizeServerName(name);
      const attempts =
        (this.reconnectAttemptsByServer.get(normalizedName) ?? 0) + 1;
      this.reconnectAttemptsByServer.set(normalizedName, attempts);
      this.enqueueReconnect(name);
    }
  }

  private async attemptReconnect(name: string): Promise<boolean> {
    const normalizedName = normalizeServerName(name);
    const existing = this._clientsByService.get(normalizedName);

    if (!existing || isConnected(existing)) {
      return false;
    }

    const { targetServer } = existing;
    this.logger.debug("Attempting upstream server reconnect", { name });

    const connecting: ConnectingTargetClient = {
      _state: "connecting",
      targetServer,
    };
    await this.recordClientUpsert(connecting);

    const newClient = await this.connector.connect(targetServer);
    if (
      this.shuttingDown ||
      this._clientsByService.get(normalizedName) !== connecting
    ) {
      if (isConnected(newClient)) {
        await newClient.extendedClient.close().catch((error) => {
          this.logger.warn("Failed to close discarded reconnect client", {
            name,
            error: loggableError(error),
          });
        });
      }
      return false;
    }
    await this.recordClientUpsert(newClient);

    this.logger.debug("Upstream server reconnect attempt finished", {
      name,
      state: newClient._state,
    });

    // A confirmed need for sign-in waits for user action.
    return !isConnected(newClient) && !isPendingAuth(newClient);
  }

  private notifyPostChangeHooks(): void {
    for (const [hookName, hook] of this.postChangeHooks) {
      try {
        hook(this.targetServers);
      } catch (error) {
        this.logger.error("Post change hook failed", {
          hookName,
          error: loggableError(error),
        });
      }
    }
  }

  // A method to find and narrow down the type of a client to PendingAuthTargetClient.
  // Throws if not found or if the client is not in pendingAuth state.
  private async getPendingAuthClient(
    targetServerName: string,
  ): Promise<PendingAuthTargetClient> {
    const client = this._clientsByService.get(
      normalizeServerName(targetServerName),
    );
    if (!client) {
      this.logger.error("No client found for target server", {
        targetServerName,
      });
      return Promise.reject(new NotFoundError("Client not found"));
    }
    if (isPendingAuth(client)) {
      return client;
    }
    this.logger.info("Found client is not pendingAuth", {
      targetServerName,
      type: client._state,
    });
    return Promise.reject(new NotFoundError("Client is not pendingAuth"));
  }

  private getConnectedClientByName(
    serviceName: string,
  ): ConnectedTargetClient | null {
    const client = this._clientsByService.get(normalizeServerName(serviceName));
    if (!client || client._state !== "connected") {
      return null;
    }
    return client;
  }

  private async executeWithAuthRetry<T>(
    client: ConnectedTargetClient,
    context: string,
    action: (extendedClient: ExtendedClientI) => Promise<T>,
  ): Promise<T> {
    // Proactive check: if the token is already expired locally, skip the call
    // entirely. Without this, the transport calls redirectToAuthorization() on
    // a 401, which blocks on an unresolved Promise until the user re-auths —
    // causing a request hang rather than a fast TokenExpiredError.
    if (
      hasRemoteTargetServer(client) &&
      this.isOAuthServer(client.targetServer.name) &&
      (await this.oauthConnectionHandler.isTokenExpiredForServer(
        client.targetServer,
      ))
    ) {
      await this.transitionClientToExpired(client);
      throw new TokenExpiredError(client.targetServer.name);
    }

    const { name } = client.targetServer;
    try {
      const result = await action(client.extendedClient);
      this._watchdog.reportSuccess(name);
      return result;
    } catch (e) {
      // Any answer, even an error one, proves the server is reachable. Only a
      // transport failure counts against it, and the watchdog threshold decides.
      if (isTransportError(e) && !isAuthenticationError(e)) {
        this._watchdog.reportFailure(name, makeError(e));
      } else {
        this._watchdog.reportSuccess(name);
      }
      if (isAuthenticationError(e)) {
        const recovered = await this.handleAuthFailure(client, context);
        if (recovered) {
          return await action(recovered.extendedClient);
        }
        // Recovery failed — if this is an OAuth server, signal the agent to re-auth
        if (this.isOAuthServer(name)) {
          throw new TokenExpiredError(name);
        }
      }
      throw e;
    }
  }

  private async handleAuthFailure(
    client: ConnectedTargetClient,
    context: string,
  ): Promise<ConnectedTargetClient | null> {
    const targetServer = client.targetServer;
    if (
      targetServer.type !== "sse" &&
      targetServer.type !== "streamable-http"
    ) {
      return null;
    }
    const name = targetServer.name;
    const normalizedName = normalizeServerName(name);
    const existingRecovery = this.authRecoveryByService.get(normalizedName);
    if (existingRecovery) {
      return await existingRecovery;
    }
    const recovery = this.runAuthRecovery(client, targetServer, context);

    this.authRecoveryByService.set(normalizedName, recovery);
    try {
      return await recovery;
    } finally {
      if (this.authRecoveryByService.get(normalizedName) === recovery) {
        this.authRecoveryByService.delete(normalizedName);
      }
    }
  }

  private async runAuthRecovery(
    client: ConnectedTargetClient,
    targetServer: RemoteTargetServer,
    context: string,
  ): Promise<ConnectedTargetClient | null> {
    const name = targetServer.name;
    this.logger.warn("Auth failed, attempting silent re-auth", {
      name,
      context,
    });
    await client.extendedClient.close().catch((closeError) => {
      this.logger.warn("Failed to close client after auth error", {
        name,
        error: loggableError(closeError),
      });
    });
    const reauth =
      await this.oauthConnectionHandler.safeTryWithExistingTokens(targetServer);
    if (reauth.kind === "rate-limited") {
      await this.recordClientUpsert(this.connector.rateLimited(targetServer));
      return null;
    }
    if (reauth.kind === "token-store-unavailable") {
      await this.recordClientUpsert({
        _state: "connection-failed",
        targetServer,
        error: reauth.error,
      });
      this.enqueueReconnect(name);
      return null;
    }
    if (reauth.kind === "connected") {
      const finalClient = await this.recordClientUpsert(
        await this.connector.finalize(targetServer, reauth.client),
      );
      if (isConnected(finalClient)) {
        this.logger.info("Silent re-auth succeeded", { name, context });
        return finalClient;
      }
      this.logger.warn("Silent re-auth connected but capability load failed", {
        name,
        context,
      });
      return null;
    }

    const tokenExpired =
      await this.oauthConnectionHandler.isTokenExpiredForServer(targetServer);
    if (tokenExpired) {
      // Tokens were rejected (deleted on 401) or never existed → prompt re-auth.
      this.logger.warn(
        "Silent re-auth failed: no valid tokens, marking pending-auth",
        {
          name,
          context,
        },
      );
      await this.transitionToPendingAuth(targetServer);
    } else {
      // Tokens still exist but server was unreachable → connection-failed + schedule retry.
      this.logger.warn(
        "Silent re-auth failed: server unreachable, will retry",
        {
          name,
          context,
        },
      );
      await this.recordClientUpsert({
        _state: "connection-failed",
        targetServer,
        error: new Error("Server unreachable during re-auth"),
      });
      this.enqueueReconnect(name);
    }
    return null;
  }

  private startTokenExpiryMonitor(): void {
    const TOKEN_EXPIRY_CHECK_INTERVAL_MS = 30_000;
    this.tokenExpiryInterval = setInterval(() => {
      this.checkTokenExpiry().catch((error) => {
        this.logger.error("Token expiry check failed", {
          error: loggableError(error),
        });
      });
    }, TOKEN_EXPIRY_CHECK_INTERVAL_MS).unref();
  }

  private async checkTokenExpiry(): Promise<void> {
    const clients = Array.from(this._clientsByService.values()).filter(
      (client): client is RemoteConnectedTargetClient =>
        isConnected(client) &&
        this.isOAuthServer(client.targetServer.name) &&
        hasRemoteTargetServer(client),
    );

    const results = await Promise.all(
      clients.map(async (client) => ({
        client,
        expired: await this.oauthConnectionHandler.isTokenExpiredForServer(
          client.targetServer,
        ),
      })),
    );

    await Promise.all(
      results
        .filter(({ expired }) => expired)
        .map(({ client }) => this.transitionClientToExpired(client)),
    );
  }

  private async transitionToPendingAuth(
    targetServer: RemoteTargetServer,
  ): Promise<PendingAuthTargetClient> {
    const pendingAuth: PendingAuthTargetClient = {
      _state: "pending-auth",
      targetServer,
    };
    await this.recordClientUpsert(pendingAuth);
    return pendingAuth;
  }

  private async transitionClientToExpired(
    client: RemoteConnectedTargetClient,
  ): Promise<void> {
    this.logger.info(
      "Token expired for connected OAuth server, transitioning to pending-auth",
      { name: client.targetServer.name },
    );
    await client.extendedClient.close().catch((closeError) => {
      this.logger.warn("Failed to close client on token expiry", {
        name: client.targetServer.name,
        error: loggableError(closeError),
      });
    });
    await this.transitionToPendingAuth(client.targetServer);
  }

  private prepareForSystemState(
    targetClient: TargetClient,
    approvedTools: Tool[] = [],
    originalTools?: Tool[],
    approvedPrompts: Prompt[] = [],
    originalPrompts?: Prompt[],
    promptMessages?: Record<string, PromptMessage[]>,
    displayName?: string,
  ): TargetServerNewWithoutUsage {
    return prepareForSystemState(
      targetClient,
      (tool) => this.toolTokenEstimator.estimateTokens(tool),
      approvedTools,
      originalTools,
      approvedPrompts,
      originalPrompts,
      promptMessages,
      displayName,
    );
  }
}
