// No unit test: this is a god object that interleaves pure decisions, effectful
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
import {
  makeError,
  normalizeServerName,
  stringifyEq,
} from "@mcpx/toolkit-core/data";
import { loggableError, LunarLogger } from "@mcpx/toolkit-core/logging";
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
  isPendingInputError,
  NotAllowedError,
  NotFoundError,
  TokenExpiredError,
} from "../errors.js";
import { RemoteTargetServer, TargetServer } from "../model/target-servers.js";
import { CatalogChange, CatalogManagerI } from "./catalog-manager.js";
import { ExtendedClientI, isTransportError } from "./client-extension.js";
import {
  fetchPromptCapabilities,
  fetchPromptMessages,
  fetchServerCapabilities,
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
  PendingAuthTargetClient,
  isConnected,
  isConnectionFailed,
} from "./target-client-types.js";
import { UpstreamWatchdog } from "./upstream-watchdog.js";

export interface UpstreamHandlerConfig {
  pingIntervalMs: number;
  pingTimeoutMs: number;
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
  completeOAuthByState(state: string, code: string): Promise<void>;
}

function sameStringSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
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
  private readonly reconnectQueue = new Map<string, NodeJS.Timeout>();
  private readonly reconnectAttemptsByServer = new Map<string, number>();
  private readonly reconnectBaseDelayMs: number;
  private previousToolExtensions: ToolExtensions["services"] = {};
  private unsubscribeConfig?: () => void;

  constructor(
    private systemState: SystemStateTracker,
    private serverConfigManager: ServerConfigManager,
    private connectionFactory: TargetServerConnectionFactory,
    private oauthConnectionHandler: OAuthConnectionHandler,
    private catalogManager: CatalogManagerI,
    private toolTokenEstimator: ToolTokenEstimator,
    private capabilityRegistry: CapabilityRegistry,
    private capabilityResolver: CapabilityResolver,
    private configService: ConfigService,
    private logger: LunarLogger,
    config: UpstreamHandlerConfig,
  ) {
    this.logger = logger.child({ component: "UpstreamHandler" });
    this.reconnectBaseDelayMs = config.reconnectBaseDelayMs;
    this._watchdog = new UpstreamWatchdog(
      {
        pingServer: (name): Promise<Error | null> =>
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
        .find(
          (item) => normalizeServerName(item.server.name) === normalizedName,
        );
      if (matchingCatalogItem) {
        return { ...server, catalogItemId: matchingCatalogItem.server.id };
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
      pendingClient?._state === "pending-auth" &&
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

    const client = await this.safeInitiateClient(targetServer);
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
        const client = await this.safeInitiateClient(server);
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
        await this.finalizeConnection(targetServer, extendedClient),
      );
    };
    // initiateOAuth dedupes per server, so repeat or concurrent calls reuse the
    // same flow instead of opening another tab.
    return this.oauthConnectionHandler.initiateOAuth(targetServer, {
      callbackUrl,
      onComplete,
      resetStaleTokens: client._state === "pending-auth",
    });
  }

  /** Returns true if the server has an active OAuth provider this session. */
  isOAuthServer(serverName: string): boolean {
    return this.oauthConnectionHandler.isOAuthServer(serverName);
  }

  /**
   * Phase 2: Complete OAuth flow for a pending-auth server with authorization code.
   * Transitions server from pending-auth to connected (or connection-failed on error).
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

      const newTargetClient = await this.finalizeConnection(
        targetServer,
        extendedClient,
      );
      await this.recordClientUpsert(newTargetClient);
    } catch (e) {
      const error = makeError(e);
      this.logger.error("Failed to complete OAuth, reverting to pending-auth", {
        targetServerName,
        error: loggableError(error),
      });
      await this.transitionToPendingAuth(targetServer);
      throw error;
    }
  }

  // An internal method that reuses OAuth tokens for a given pendingAuth client.
  private async reuseOAuth(
    pendingAuth: PendingAuthTargetClient,
  ): Promise<ExtendedClientI> {
    const extendedClient =
      await this.oauthConnectionHandler.safeTryWithExistingTokens(
        pendingAuth.targetServer,
      );
    if (!extendedClient) {
      this.logger.info("Could not reuse possible OAuth tokens", {
        targetServerName: pendingAuth.targetServer.name,
      });
      // TODO: Add a more specific error message here
      return Promise.reject(new FailedToConnectToTargetServer());
    }
    this.logger.info("OAuth connection established", {
      targetServerName: pendingAuth.targetServer.name,
    });
    // Update the clientsByService map - this will replace the pendingAuth entry
    const newTargetClient = await this.finalizeConnection(
      pendingAuth.targetServer,
      extendedClient,
    );
    await this.recordClientUpsert(newTargetClient);
    return extendedClient;
  }

  // A method to record state about new client or update existing client.
  // Will update both the internal map and the system state tracker.
  private async recordClientUpsert(
    newTargetClient: TargetClient,
  ): Promise<void> {
    const normalizedName = normalizeServerName(
      newTargetClient.targetServer.name,
    );

    this.dropListChangedSubscriptions(normalizedName);

    this._clientsByService.set(normalizedName, newTargetClient);

    if (isConnected(newTargetClient)) {
      this.cancelReconnect(newTargetClient.targetServer.name);
      this.reconnectAttemptsByServer.delete(normalizedName);
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
      // Registry already populated by finalizeConnection.
      void this.kickoffPromptMessagesFetch(serverName, newTargetClient);
    } else if (newTargetClient._state === "pending-auth") {
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
    } else if (newTargetClient._state !== "connecting") {
      this.capabilityRegistry.unregisterServer(normalizedName);
    }

    // Approvals are discarded for "connecting" state; skip the lookup.
    const skipApprovals = newTargetClient._state === "connecting";
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
    );
    this.systemState.recordTargetServerConnection(systemStateTargetServer);

    if (newTargetClient._state !== "connecting") {
      this.notifyPostChangeHooks();
    }
  }

  // Registry write happens in the same step that produces the connected
  // client, so capability-state and connection-state advance together. Safe
  // only because callers await no I/O between this registry write and the
  // recordClientUpsert that commits the connected client, so no tool call can
  // interleave and see a listable-but-not-connected capability. Auth tool is
  // registered separately on pending-auth — agents shouldn't see it while the
  // upstream is working. Failure short-circuits to connection-failed; reconnect
  // path picks it up.
  private finalizeConnection(
    targetServer: TargetServer,
    extendedClient: ExtendedClientI,
  ): Promise<TargetClient> {
    return fetchServerCapabilities(extendedClient, this.logger)
      .then((capabilities): TargetClient => {
        this.capabilityRegistry.registerServer(
          normalizeServerName(targetServer.name),
          capabilities,
        );
        return { _state: "connected", targetServer, extendedClient };
      })
      .catch((e): TargetClient => {
        this.logger.warn("Failed to load capabilities on connect", {
          name: targetServer.name,
          error: loggableError(e),
        });
        return {
          _state: "connection-failed",
          targetServer,
          error: makeError(e),
        };
      });
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
  ): Promise<Error | null> {
    const client = this.getConnectedClientByName(name);
    if (!client) return null;
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
      void this.runReconnect(name);
    }, delay);
    this.reconnectQueue.set(normalizedName, timeout);
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

    await this.recordClientUpsert({ _state: "connecting", targetServer });

    const newClient = await this.safeInitiateClient(targetServer);
    await this.recordClientUpsert(newClient);

    this.logger.debug("Upstream server reconnect attempt finished", {
      name,
      state: newClient._state,
    });

    // Keep retrying until connected or server is removed.
    return !isConnected(newClient);
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
    if (client._state === "pending-auth") {
      return client;
    }
    this.logger.info("Found client is not pendingAuth", {
      targetServerName,
      type: client._state,
    });
    return Promise.reject(new NotFoundError("Client is not pendingAuth"));
  }

  // A method to safely initiate a client connection.
  // Should always return a resolved Promise.
  private async safeInitiateClient(
    targetServer: TargetServer,
  ): Promise<TargetClient> {
    // Error might be a connection error, either on an initial connection
    // or when retrying with OAuth.
    // We handle it once, in the end of the method, and return undefined if that happens.
    let error: Error | undefined;

    const catalogServer = targetServer.catalogItemId
      ? this.catalogManager.getById(targetServer.catalogItemId)
      : null;

    if (targetServer.catalogItemId && !catalogServer) {
      const error = new FailedToConnectToTargetServer(
        `Target server "${targetServer.name}" references catalog item "${targetServer.catalogItemId}", but it was not found in the catalog.`,
      );
      this.logger.error("Catalog item referenced by target server not found", {
        name: targetServer.name,
        catalogItemId: targetServer.catalogItemId,
        error: loggableError(error),
      });
      return { _state: "connection-failed", targetServer, error };
    }

    const envRequirements =
      catalogServer?.server.config.type === "stdio"
        ? catalogServer.server.config.env
        : undefined;

    // Static OAuth configured means the server needs auth, even if a plain
    // connect would succeed. Route through the OAuth path so it reuses tokens
    // or transitions to pending-auth instead of finalizing without a provider.
    if (
      (targetServer.type === "sse" ||
        targetServer.type === "streamable-http") &&
      this.oauthConnectionHandler.hasStaticOAuthForUrl(targetServer.url)
    ) {
      this.logger.debug(
        "Static OAuth configuration found for server, attempting OAuth flow",
        { name: targetServer.name },
      );
      try {
        return await this.initiateRemoteUnauthedClient(targetServer);
      } catch (oauthError) {
        return {
          _state: "connection-failed",
          targetServer,
          error: makeError(oauthError),
        };
      }
    }

    try {
      const extendedClient = await this.connectionFactory.createConnection(
        targetServer,
        envRequirements,
        // Watermark headers from the catalog (see privateHeadersSchema).
        catalogServer?.adminConfig?.privateHeaders,
      );
      return await this.finalizeConnection(targetServer, extendedClient);
    } catch (initialError) {
      error = makeError(initialError);

      // Check for pending input (missing env vars)
      if (isPendingInputError(initialError)) {
        this.logger.info("Server has missing environment variables", {
          name: targetServer.name,
          missingEnvVars: initialError.missingEnvVars,
        });
        return {
          _state: "pending-input",
          targetServer,
          missingEnvVars: initialError.missingEnvVars,
        };
      }

      // Check if OAuth is required
      if (
        isAuthenticationError(error) &&
        (targetServer.type === "sse" || targetServer.type === "streamable-http")
      ) {
        // Server requires OAuth authentication
        this.logger.warn(
          "Server requires OAuth authentication, attempting OAuth flow",
          { name: targetServer.name, type: targetServer.type },
        );

        // Attempt OAuth - this will try static OAuth if configured, or DCR as fallback
        // If the provider can't be created (e.g., missing credentials), it will throw
        try {
          return await this.initiateRemoteUnauthedClient(targetServer);
        } catch (oauthError) {
          error = makeError(oauthError);
          // Proceed to return connection-failed below
        }
      }

      // For non-OAuth errors or stdio connections, return undefined
      this.logger.error("Failed to initiate client", {
        name: targetServer.name,
        type: targetServer.type,
        error: loggableError(error),
      });
      return { _state: "connection-failed", targetServer, error };
    }
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
      (client.targetServer.type === "sse" ||
        client.targetServer.type === "streamable-http") &&
      this.isOAuthServer(client.targetServer.name) &&
      (await this.oauthConnectionHandler.isTokenExpiredForServer(
        client.targetServer,
      ))
    ) {
      await this.transitionClientToExpired(
        client as ConnectedTargetClient & {
          targetServer: RemoteTargetServer;
        },
      );
      throw new TokenExpiredError(client.targetServer.name);
    }

    try {
      return await action(client.extendedClient);
    } catch (e) {
      if (isAuthenticationError(e)) {
        const recovered = await this.handleAuthFailure(client, context);
        if (recovered) {
          return await action(recovered.extendedClient);
        }
        // Recovery failed — if this is an OAuth server, signal the agent to re-auth
        if (this.isOAuthServer(client.targetServer.name)) {
          throw new TokenExpiredError(client.targetServer.name);
        }
      }
      // Transport failure — server is unreachable. Trigger reconnect in the background
      // so the agent gets an immediate error response while recovery proceeds.
      if (isTransportError(e)) {
        void this.onServerUnreachable(client.targetServer.name, makeError(e));
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
    const reauthedClient =
      await this.oauthConnectionHandler.safeTryWithExistingTokens(targetServer);
    if (reauthedClient) {
      const finalClient = await this.finalizeConnection(
        targetServer,
        reauthedClient,
      );
      await this.recordClientUpsert(finalClient);
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

  // Applies the auth component's verdict to our connection state. The decision
  // itself lives in OAuthConnectionHandler.
  private async initiateRemoteUnauthedClient(
    targetServer: RemoteTargetServer,
  ): Promise<TargetClient> {
    const verdict =
      await this.oauthConnectionHandler.resolveExistingAuth(targetServer);
    const log = { name: targetServer.name, type: targetServer.type };

    switch (verdict.kind) {
      case "connected": {
        const connected = await this.finalizeConnection(
          targetServer,
          verdict.client,
        );
        await this.recordClientUpsert(connected);
        return connected;
      }
      case "not-oauth":
        this.logger.warn(
          "Server returned 401 but does not advertise OAuth metadata; treating as connection failure",
          log,
        );
        return {
          _state: "connection-failed",
          targetServer,
          error: new Error(
            "Authentication required, but server does not support OAuth",
          ),
        };
      case "unreachable":
        // Tokens kept; watchdog retries.
        this.logger.info(
          "Server unreachable, tokens preserved for reconnect",
          log,
        );
        return {
          _state: "connection-failed",
          targetServer,
          error: new Error("Server unreachable"),
        };
      case "needs-auth":
        this.logger.info(
          `Server requires OAuth authentication, call /auth/initiate/${targetServer.name} to start`,
          log,
        );
        return this.transitionToPendingAuth(targetServer);
    }
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
      (
        client,
      ): client is ConnectedTargetClient & {
        targetServer: RemoteTargetServer;
      } =>
        isConnected(client) &&
        this.isOAuthServer(client.targetServer.name) &&
        (client.targetServer.type === "sse" ||
          client.targetServer.type === "streamable-http"),
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
    client: ConnectedTargetClient & { targetServer: RemoteTargetServer },
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
  ): TargetServerNewWithoutUsage {
    return prepareForSystemState(
      targetClient,
      (tool) => this.toolTokenEstimator.estimateTokens(tool),
      approvedTools,
      originalTools,
      approvedPrompts,
      originalPrompts,
      promptMessages,
    );
  }
}
