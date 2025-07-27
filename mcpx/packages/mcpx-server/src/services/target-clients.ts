import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import { env } from "../env.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { RemoteTargetServer, TargetServer } from "../model/target-servers.js";
import { ExtendedClientI } from "./client-extension.js";
import {
  isAuthenticationError,
  OAuthConnectionHandler,
} from "./oauth-connection-handler.js";
import { ServerConfigManager } from "./server-config-manager.js";
import {
  SystemStateTracker,
  TargetServerNewWithoutUsage,
} from "./system-state.js";
import {
  buildClient,
  TargetServerConnectionFactory,
} from "./target-server-connection-factory.js";
import { makeError } from "@mcpx/toolkit-core/data";

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

// This class manages connections to target MCP servers, via initializing
// `Client` instances, extending them into `ExtendedClient` instances,
// storing them in a map, and providing methods to add, remove, and list clients.
export class TargetClients {
  private _clientsByService: Map<string, TargetClient> = new Map();
  private targetServers: TargetServer[] = [];
  private initialized = false;

  constructor(
    private systemState: SystemStateTracker,
    private serverConfigManager: ServerConfigManager,
    private connectionFactory: TargetServerConnectionFactory,
    private oauthConnectionHandler: OAuthConnectionHandler,
    private logger: Logger,
  ) {
    this.logger = logger.child({ component: "TargetClients" });
  }

  async initialize(): Promise<void> {
    if (env.READ_TARGET_SERVERS_FROM_FILE) {
      this.targetServers = this.serverConfigManager.readTargetServers();
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

  shutdown(): void {
    this.logger.info("Shutting down TargetClients...");

    // Close all connected clients
    this._connectedClientsByService().forEach((client, name) => {
      client
        .close()
        .then(() => {
          this.logger.info("Client closed", { name });
        })
        .catch((e: unknown) => {
          const error = loggableError(e);
          this.logger.error("Error closing client", { name, error });
        });
    });
  }

  getTargetServer(name: string): TargetServer | undefined {
    if (!this.initialized) {
      throw new Error("TargetClients not initialized");
    }
    return this.targetServers.find((server) => server.name === name);
  }

  async removeClient(name: string): Promise<void> {
    const client = this._clientsByService.get(name);
    if (!client) {
      this.logger.warn("Client not found", { name });
      return Promise.reject(new NotFoundError());
    }
    try {
      if (client._state === "connected") {
        await client.extendedClient.close();
      }
      this.recordClientRemoved(name);

      // Remove from targetServers and persist
      this.targetServers = this.targetServers.filter(
        (server) => server.name !== name,
      );
      this.serverConfigManager.writeTargetServers(this.targetServers);
      this.logger.info("Client removed", { name });
    } catch (e: unknown) {
      const error = loggableError(e);
      this.logger.error("Error removing client", { name, error });
    }
  }

  async addClient(targetServer: TargetServer): Promise<void> {
    if (this._clientsByService.has(targetServer.name)) {
      this.logger.warn("Client name already exists", {
        name: targetServer.name,
      });
      return Promise.reject(new AlreadyExistsError());
    }

    // Add to targetServers
    this.targetServers.push(targetServer);

    const client = await this.safeInitiateClient(targetServer);
    this.serverConfigManager.writeTargetServers(this.targetServers);
    this.recordClientUpsert(client);
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
      this.targetServers.map((server) =>
        this.safeInitiateClient(server).then((client) => {
          if (!client) {
            return;
          }
          this.recordClientUpsert(client);
        }),
      ),
    );
  }

  // A method to reuse existing OAuth tokens if available.
  // Will throw an error if the target server is not in pendingAuth state or
  // if reusing tokens fails (missing/rejected tokens)
  async reuseOAuthByName(targetServerName: string): Promise<ExtendedClientI> {
    const pendingAuth = await this.getPendingAuthClient(targetServerName);
    return await this.reuseOAuth(pendingAuth);
  }

  async initiateOAuth(targetServerName: string): Promise<void> {
    const pendingAuth = await this.getPendingAuthClient(targetServerName);

    const client = buildClient(targetServerName);

    try {
      const extendedClient = await this.oauthConnectionHandler.tryWithOAuth(
        pendingAuth.targetServer,
        client,
      );
      this.logger.info("OAuth connection established", {
        targetServerName,
        tools: await extendedClient.listTools(),
      });
      // Update the clientsByService map - this will replace the pendingAuth entry
      const newTargetClient: TargetClient = {
        _state: "connected" as const,
        targetServer: pendingAuth.targetServer,
        extendedClient,
      };
      this.recordClientUpsert(newTargetClient);
      return;
    } catch (e) {
      const error = makeError(e);
      this.logger.error("Failed to initiate OAuth", {
        targetServerName,
        error: loggableError(error),
      });
      const newTargetClient = {
        _state: "connection-failed" as const,
        targetServer: pendingAuth.targetServer,
        error,
      };
      this.recordClientUpsert(newTargetClient);
      return Promise.reject(error);
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
      return Promise.reject(new FailedToConnectToTargetServer());
    }
    this.logger.info("OAuth connection established", {
      targetServerName: pendingAuth.targetServer.name,
      tools: await extendedClient.listTools(),
    });
    // Update the clientsByService map - this will replace the pendingAuth entry
    const newTargetClient: TargetClient = {
      _state: "connected" as const,
      targetServer: pendingAuth.targetServer,
      extendedClient,
    };
    this.recordClientUpsert(newTargetClient);
    return extendedClient;
  }

  // A method to record state about new client or update existing client.
  // Will update both the internal map and the system state tracker.
  private recordClientUpsert(newTargetClient: TargetClient): void {
    this._clientsByService.set(
      newTargetClient.targetServer.name,
      newTargetClient,
    );
    const systemStateTargetServer = prepareForSystemState(newTargetClient);
    this.systemState.recordTargetServerConnection(systemStateTargetServer);
  }

  // A method to record that a client was removed.
  // Will remove it from the internal map and update the system state tracker.
  private recordClientRemoved(name: string): void {
    this._clientsByService.delete(name);
    this.systemState.recordTargetServerDisconnected({ name });
  }

  // A method to find and narrow down the type of a client to PendingAuthTargetClient.
  // Throws if not found or if the client is not in pendingAuth state.
  private async getPendingAuthClient(
    targetServerName: string,
  ): Promise<PendingAuthTargetClient> {
    const client = this._clientsByService.get(targetServerName);
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
        return await this.safeInitiateRemoteUnauthedClient(targetServer);
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

  private async safeInitiateRemoteUnauthedClient(
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
      this.logger.info(
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
}

function prepareForSystemState(
  targetClient: TargetClient,
): TargetServerNewWithoutUsage {
  switch (targetClient._state) {
    case "connected": {
      const state = { type: "connected" as const };
      const { extendedClient, targetServer } = targetClient;
      const { tools } = extendedClient.cachedListTools();
      const { tools: originalTools } = extendedClient.cachedOriginalListTools();
      switch (targetServer.type) {
        case "stdio":
          return {
            _type: "stdio",
            state,
            ...targetServer,
            tools,
            originalTools,
          };
        case "sse":
          return { _type: "sse", state, ...targetServer, tools, originalTools };
        case "streamable-http":
          return {
            _type: "streamable-http",
            state,
            ...targetServer,
            tools,
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
            state: { type: "connection-failed" },
            ...targetClient.targetServer,
            tools: [],
            originalTools: [],
          };
        case "sse":
        case "streamable-http":
          return {
            _type: targetClient.targetServer.type,
            state: { type: "connection-failed", error: targetClient.error },
            ...targetClient.targetServer,
            tools: [],
            originalTools: [],
          };
      }
  }
}
