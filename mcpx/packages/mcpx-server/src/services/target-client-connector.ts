import { makeError } from "@aigw/core/data";
import { loggableError, TelemetryLogger } from "@aigw/core/logging";

import {
  FailedToConnectToTargetServer,
  isPendingInputError,
} from "../errors.js";
import { RemoteTargetServer, TargetServer } from "../model/target-servers.js";
import { ServerCapabilities } from "./capability-registry.js";
import { CatalogManagerI } from "./catalog-manager.js";
import { ExtendedClientI, isRateLimitError } from "./client-extension.js";
import { fetchServerCapabilities } from "./fetch-capabilities.js";
import {
  isAuthenticationError,
  OAuthConnectionHandler,
} from "./oauth-connection-handler.js";
import {
  ConnectedTargetClient,
  ConnectionFailedTargetClient,
  PendingAuthTargetClient,
  TargetClient,
} from "./target-client-types.js";
import { TargetServerConnectionFactory } from "./target-server-connection-factory.js";

// A client state to commit. A connected client carries the capabilities just
// fetched for it, which recordClientUpsert registers when it commits the client.
export type TargetClientUpsert =
  | Exclude<TargetClient, ConnectedTargetClient>
  | (ConnectedTargetClient & { capabilities: ServerCapabilities });

function isRemoteTargetServer(
  targetServer: TargetServer,
): targetServer is RemoteTargetServer {
  return targetServer.type === "sse" || targetServer.type === "streamable-http";
}

// Connects a target server and returns the client state the attempt produced.
// It holds no client state and has no way to record one: the caller commits
// the result, so a caller can still discard it (a stale reconnect).
export class TargetClientConnector {
  constructor(
    private connectionFactory: TargetServerConnectionFactory,
    private oauthConnectionHandler: OAuthConnectionHandler,
    private catalogManager: CatalogManagerI,
    // Read for logs only; the reconnect schedule stays with the caller.
    private reconnectAttempts: (serverName: string) => number,
    private logger: TelemetryLogger,
  ) {}

  // A method to safely initiate a client connection.
  // Should always return a resolved Promise.
  async connect(targetServer: TargetServer): Promise<TargetClientUpsert> {
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
      this.hasStaticOauthConfigured(targetServer)
    ) {
      this.logger.debug(
        "Static OAuth configuration found for server, attempting OAuth flow",
        { name: targetServer.name },
      );
      try {
        return await this.initiateRemoteUnauthedClient(targetServer);
      } catch (oauthError) {
        return this.connectionFailedClient(targetServer, makeError(oauthError));
      }
    }

    try {
      const extendedClient = await this.connectionFactory.createConnection(
        targetServer,
        envRequirements,
        // Watermark headers from the catalog (see privateHeadersSchema).
        catalogServer?.adminConfig?.privateHeaders,
      );
      return await this.finalize(targetServer, extendedClient);
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
      return this.connectionFailedClient(targetServer, error);
    }
  }

  // Fetches the capabilities of a connected client. recordClientUpsert
  // registers them when it commits the client, so capability-state and
  // connection-state advance together. Failure short-circuits to
  // connection-failed; reconnect path picks it up.
  finalize(
    targetServer: TargetServer,
    extendedClient: ExtendedClientI,
  ): Promise<TargetClientUpsert> {
    return fetchServerCapabilities(extendedClient, this.logger)
      .then(
        (capabilities): TargetClientUpsert => ({
          _state: "connected",
          targetServer,
          extendedClient,
          capabilities,
        }),
      )
      .catch((e): TargetClientUpsert => {
        this.logger.warn("Failed to load capabilities on connect", {
          name: targetServer.name,
          error: loggableError(e),
        });
        return this.connectionFailedClient(targetServer, makeError(e));
      });
  }

  // Logs the 429 and returns the pending-auth it leads to. Recording
  // pending-auth cancels the reconnect, so a result the caller discards (a
  // stale reconnect) leaves the newer state's timer alone.
  rateLimited(targetServer: RemoteTargetServer): PendingAuthTargetClient {
    this.logger.warn(
      "Upstream server rate limited the connection, waiting for user login",
      {
        name: targetServer.name,
        status: 429,
        attempts: this.reconnectAttempts(targetServer.name),
      },
    );
    return { _state: "pending-auth", targetServer };
  }

  private hasStaticOauthConfigured(targetServer: RemoteTargetServer): boolean {
    if (
      targetServer.catalogItemId &&
      this.oauthConnectionHandler.hasCatalogItemOAuth(
        targetServer.catalogItemId,
      )
    ) {
      return true;
    }
    return this.oauthConnectionHandler.hasStaticOAuthForUrl(targetServer.url);
  }

  // Turns the auth component's verdict into a client state. The decision
  // itself lives in OAuthConnectionHandler.
  private async initiateRemoteUnauthedClient(
    targetServer: RemoteTargetServer,
  ): Promise<TargetClientUpsert> {
    const verdict =
      await this.oauthConnectionHandler.resolveExistingAuth(targetServer);
    const log = { name: targetServer.name, type: targetServer.type };

    switch (verdict.kind) {
      case "connected":
        return this.finalize(targetServer, verdict.client);
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
      case "token-store-unavailable":
        return {
          _state: "connection-failed",
          targetServer,
          error: verdict.error,
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
      case "rate-limited":
        return this.rateLimited(targetServer);
      case "needs-auth":
        this.logger.info(
          `Server requires OAuth authentication, call /auth/initiate/${targetServer.name} to start`,
          log,
        );
        return { _state: "pending-auth", targetServer };
    }
  }

  private connectionFailedClient(
    targetServer: TargetServer,
    error: Error,
  ): PendingAuthTargetClient | ConnectionFailedTargetClient {
    if (
      isRateLimitError(error) &&
      isRemoteTargetServer(targetServer) &&
      this.oauthConnectionHandler.isOAuthServer(targetServer.name)
    ) {
      return this.rateLimited(targetServer);
    }
    return { _state: "connection-failed", targetServer, error };
  }
}
