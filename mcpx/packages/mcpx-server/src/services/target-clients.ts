import { makeError, normalizeServerName } from "@mcpx/toolkit-core/data";
import { loggableError, LunarLogger } from "@mcpx/toolkit-core/logging";
import { env } from "../env.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  InvalidSchemaError,
  NotAllowedError,
  NotFoundError,
} from "../errors.js";
import { LOG_FLAGS } from "../log-flags.js";
import { RemoteTargetServer, TargetServer } from "../model/target-servers.js";
import { CatalogChange, CatalogManagerI } from "./catalog-manager.js";
import { ExtendedClientI, extractToolParameters } from "./client-extension.js";
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

interface ConnectedTargetClient {
  _state: "connected";
  targetServer: TargetServer;
  extendedClient: ExtendedClientI;
}

interface PendingAuthTargetClient {
  _state: "pending-auth";
  targetServer: RemoteTargetServer;
}

interface ConnectionFailedTargetClient {
  _state: "connection-failed";
  targetServer: TargetServer;
  error: Error;
}

type TargetClient =
  | ConnectedTargetClient
  | PendingAuthTargetClient
  | ConnectionFailedTargetClient;

export interface TargetServerChangeNotifier {
  registerPostChangeHook(hook: (servers: TargetServer[]) => void): void;
}

export interface TargetClientsOAuthHandler {
  initiateOAuthForServer(
    targetServerName: string,
    callbackUrl?: string,
  ): Promise<InitiateOAuthResult>;
  completeOAuthByState(state: string, code: string): Promise<void>;
}

// This class manages connections to target MCP servers, via initializing
// `Client` instances, extending them into `ExtendedClient` instances,
// storing them in a map, and providing methods to add, remove, and list clients.
export class TargetClients
  implements TargetServerChangeNotifier, TargetClientsOAuthHandler
{
  private _clientsByService: Map<string, TargetClient> = new Map();
  private targetServers: TargetServer[] = [];
  private initialized = false;
  private postChangeHook: ((servers: TargetServer[]) => void) | null = null;

  constructor(
    private systemState: SystemStateTracker,
    private serverConfigManager: ServerConfigManager,
    private connectionFactory: TargetServerConnectionFactory,
    private oauthConnectionHandler: OAuthConnectionHandler,
    private catalogManager: CatalogManagerI,
    private toolTokenEstimator: ToolTokenEstimator,
    private logger: LunarLogger,
  ) {
    this.logger = logger.child({ component: "TargetClients" });
    this.catalogManager.subscribe((change) => this.onCatalogChange(change));
  }

  private async onCatalogChange(change: CatalogChange): Promise<void> {
    const hasChanges =
      change.removedServers.length > 0 ||
      change.serverApprovedToolsChanged.length > 0;
    if (!hasChanges) {
      return;
    }

    this.logger.info("Catalog changed, processing updates", {
      removedServers: change.removedServers,
      serverApprovedToolsChanged: change.serverApprovedToolsChanged,
      currentRegisteredServers: Array.from(this._clientsByService.keys()),
    });

    // Disconnect servers that are no longer approved
    for (const serverName of change.removedServers) {
      // Check if server is still approved (admins can keep any server)
      if (this.catalogManager.isServerApproved(serverName)) {
        continue;
      }
      const client = this._clientsByService.get(
        normalizeServerName(serverName),
      );
      if (client) {
        this.logger.info("Disconnecting server no longer approved", {
          serverName,
        });
        await this.removeClient(serverName);
      }
    }

    // Refresh tools for servers with changed approved tools
    for (const serverName of change.serverApprovedToolsChanged) {
      const client = this._clientsByService.get(
        normalizeServerName(serverName),
      );
      if (client?._state === "connected") {
        await this.refreshClientTools(serverName, client);
      }
    }
  }

  private async refreshClientTools(
    name: string,
    client: ConnectedTargetClient,
  ): Promise<void> {
    try {
      // Cache is already invalidated by ExtendedClient's catalog subscription
      const { tools } = await client.extendedClient.listTools();
      const { tools: originalTools } =
        await client.extendedClient.originalTools();
      const toolsWithTokens = tools.map((tool) => ({
        ...tool,
        estimatedTokens: this.toolTokenEstimator.estimateTokens(tool),
      }));
      this.systemState.updateTargetServerTools({
        name,
        tools: toolsWithTokens,
        originalTools,
      });
      this.logger.debug("Refreshed tools for client", { name });
    } catch (e) {
      this.logger.error("Failed to refresh tools for client", {
        name,
        error: loggableError(e),
      });
    }
  }

  get servers(): TargetServer[] {
    return this.targetServers;
  }

  // TODO: Support adding multiple hooks
  registerPostChangeHook(hook: (servers: TargetServer[]) => void): void {
    this.postChangeHook = hook;
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
    this.logger.info("Initializing TargetClients with servers", {
      count: this.targetServers.length,
    });
    await this.reloadClients();
    this.logger.info("TargetClients initialized", {
      count: this._clientsByService.size,
    });
    this.initialized = true;
  }

  get clientsByService(): Map<string, TargetClient> {
    if (!this.initialized) {
      throw new Error("TargetClients not initialized");
    }
    return this._clientsByService;
  }

  get connectedClientsByService(): Map<string, ExtendedClientI> {
    if (!this.initialized) {
      throw new Error("TargetClients not initialized");
    }
    return this._connectedClientsByService();
  }

  private _connectedClientsByService(): Map<string, ExtendedClientI> {
    const connectedClients = new Map<string, ExtendedClientI>();
    for (const [serviceName, client] of this._clientsByService.entries()) {
      if (client._state === "connected") {
        connectedClients.set(serviceName, client.extendedClient);
      }
    }
    return connectedClients;
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down TargetClients...");

    for (const [name, client] of this._connectedClientsByService()) {
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
      throw new Error("TargetClients not initialized");
    }
    const normalizedName = normalizeServerName(name);
    return this.targetServers.find(
      (server) => normalizeServerName(server.name) === normalizedName,
    );
  }

  async removeClient(name: string): Promise<void> {
    this.logger.info("Attempting to remove client", { name });
    const normalizedName = normalizeServerName(name);
    const client = this._clientsByService.get(normalizedName);
    if (!client) {
      this.logger.warn("Client not found", { name });
      return Promise.reject(new NotFoundError());
    }
    try {
      if (client._state === "connected") {
        await client.extendedClient.close();
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

    const client = await this.safeInitiateClient(targetServer);
    this.serverConfigManager.writeTargetServers(this.targetServers);
    await this.recordClientUpsert(client);
    this.logger.info("Client added", { name: targetServer.name });
  }

  async reloadClients(): Promise<void> {
    // Disconnect all clients before reloading
    await Promise.all(
      Array.from(this._connectedClientsByService().entries()).map(
        ([name, client]) => {
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
    if (this._clientsByService.size !== 0) {
      this.logger.warn("Some clients were not closed properly", {
        clients: Array.from(this._clientsByService.keys()),
      });
      this._clientsByService.clear();
    }
    // Reconnect to all target servers
    await Promise.all(
      this.targetServers.map(async (server) => {
        const client = await this.safeInitiateClient(server);
        if (!client) return;
        await this.recordClientUpsert(client);
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
   * Phase 1: Initiate OAuth flow for a pending-auth server (non-blocking).
   * Returns the authorization URL immediately, server stays in pending-auth.
   *
   * For device flows, auto-completion will happen in the background when
   * the user authorizes. The client will be automatically registered.
   */
  async initiateOAuthForServer(
    targetServerName: string,
    callbackUrl?: string,
  ): Promise<InitiateOAuthResult> {
    const pendingAuth = await this.getPendingAuthClient(targetServerName);

    // For device flows, this callback is invoked when the user authorizes.
    // We need to register the connected client in our map.
    const onComplete = async (
      extendedClient: ExtendedClientI,
    ): Promise<void> => {
      this.logger.info("Device flow auto-completed, registering client", {
        targetServerName,
      });
      const newTargetClient: TargetClient = {
        _state: "connected" as const,
        targetServer: pendingAuth.targetServer,
        extendedClient,
      };
      await this.recordClientUpsert(newTargetClient);
    };

    return this.oauthConnectionHandler.initiateOAuth(pendingAuth.targetServer, {
      callbackUrl,
      onComplete,
    });
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
    const pendingAuth = await this.getPendingAuthClient(targetServerName);

    try {
      const extendedClient = await this.oauthConnectionHandler.completeOAuth(
        targetServerName,
        authorizationCode,
      );

      this.logger.info("OAuth connection established", { targetServerName });

      const tools = await extendedClient.listTools();
      if (LOG_FLAGS.LOG_DETAILED_TOOL_LISTINGS) {
        this.logger.debug("Available tools", { tools });
      } else {
        this.logger.debug("Available tools names", {
          toolNames: tools.tools.map((tool) => tool.name),
        });
      }

      const newTargetClient: TargetClient = {
        _state: "connected" as const,
        targetServer: pendingAuth.targetServer,
        extendedClient,
      };
      await this.recordClientUpsert(newTargetClient);
    } catch (e) {
      const error = makeError(e);
      this.logger.error("Failed to complete OAuth", {
        targetServerName,
        error: loggableError(error),
      });

      const newTargetClient: TargetClient = {
        _state: "connection-failed" as const,
        targetServer: pendingAuth.targetServer,
        error,
      };
      await this.recordClientUpsert(newTargetClient);
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
    const tools = await extendedClient.listTools();
    if (LOG_FLAGS.LOG_DETAILED_TOOL_LISTINGS) {
      this.logger.debug("Available tools", { tools });
    } else {
      this.logger.debug("Available tools names", {
        toolNames: tools.tools.map((tool) => tool.name),
      });
    }
    // Update the clientsByService map - this will replace the pendingAuth entry
    const newTargetClient: TargetClient = {
      _state: "connected" as const,
      targetServer: pendingAuth.targetServer,
      extendedClient,
    };
    await this.recordClientUpsert(newTargetClient);
    return extendedClient;
  }

  // A method to record state about new client or update existing client.
  // Will update both the internal map and the system state tracker.
  private async recordClientUpsert(
    newTargetClient: TargetClient,
  ): Promise<void> {
    this._clientsByService.set(
      normalizeServerName(newTargetClient.targetServer.name),
      newTargetClient,
    );
    const systemStateTargetServer =
      await this.prepareForSystemState(newTargetClient);
    this.systemState.recordTargetServerConnection(systemStateTargetServer);
    this.postChangeHook?.(this.targetServers);
  }

  // A method to record that a client was removed.
  // Will remove it from the internal map and update the system state tracker.
  private recordClientRemoved(name: string): void {
    this._clientsByService.delete(normalizeServerName(name));
    this.systemState.recordTargetServerDisconnected({ name });
    this.postChangeHook?.(this.targetServers);
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

    try {
      const extendedClient =
        await this.connectionFactory.createConnection(targetServer);
      return { _state: "connected", extendedClient, targetServer };
    } catch (initialError) {
      error = makeError(initialError);
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

  private async initiateRemoteUnauthedClient(
    targetServer: RemoteTargetServer,
  ): Promise<TargetClient> {
    const pendingAuthClient: PendingAuthTargetClient = {
      _state: "pending-auth",
      targetServer,
    };

    try {
      const extendedClient = await this.reuseOAuth(pendingAuthClient);
      return { _state: "connected", extendedClient, targetServer };
    } catch (reuseError) {
      const error = loggableError(reuseError);
      this.logger.debug(
        "Failed to reuse OAuth tokens, will mark as pendingAuth",
        { targetServerName: targetServer.name, error },
      );
    }
    this.logger.info(
      `Target server requires OAuth authentication, call /auth/initiate/${targetServer.name} to start`,
      { name: targetServer.name, type: targetServer.type },
    );

    return pendingAuthClient;
  }

  private async prepareForSystemState(
    targetClient: TargetClient,
  ): Promise<TargetServerNewWithoutUsage> {
    switch (targetClient._state) {
      case "connected": {
        const state = { type: "connected" as const };
        const { extendedClient, targetServer } = targetClient;
        const { tools } = await extendedClient.listTools();
        const { tools: originalTools } = await extendedClient.originalTools();

        const enrichedTools = tools.map((tool) => ({
          ...tool,
          parameters: extractToolParameters(tool),
          estimatedTokens: this.toolTokenEstimator.estimateTokens(tool),
        }));

        switch (targetServer.type) {
          case "stdio":
            return {
              _type: "stdio",
              state,
              ...targetServer,
              tools: enrichedTools,
              originalTools,
            };
          case "sse":
            return {
              _type: "sse",
              state,
              ...targetServer,
              tools: enrichedTools,
              originalTools,
            };
          case "streamable-http":
            return {
              _type: "streamable-http",
              state,
              ...targetServer,
              tools: enrichedTools,
              originalTools,
            };
        }
        break;
      }
      case "pending-auth":
        return {
          _type: targetClient.targetServer.type,
          state: { type: "pending-auth" },
          ...targetClient.targetServer,
          tools: [],
          originalTools: [],
        };
      case "connection-failed":
        switch (targetClient.targetServer.type) {
          case "stdio":
            return {
              _type: targetClient.targetServer.type,
              state: {
                type: "connection-failed",
                error: prepareError(targetClient.error),
              },
              ...targetClient.targetServer,
              tools: [],
              originalTools: [],
            };
          case "sse":
          case "streamable-http":
            return {
              _type: targetClient.targetServer.type,
              state: {
                type: "connection-failed",
                error: prepareError(targetClient.error),
              },
              ...targetClient.targetServer,
              tools: [],
              originalTools: [],
            };
        }
    }
  }
}

function prepareError(error: Error): {
  name: string;
  message: string;
  stack: string | undefined;
} {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}
