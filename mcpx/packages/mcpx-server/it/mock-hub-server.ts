import { Server, Socket } from "socket.io";
import { createServer, Server as HttpServer } from "http";
import { Logger } from "winston";
import {
  McpxBoundPayloads,
  SetIdentityPayload,
  savedSetupItemSchema,
  WEBAPP_BOUND_EVENTS,
} from "@mcpx/webapp-protocol/messages";
import z from "zod/v4";
import { v7 as uuidv7 } from "uuid";

export type SetCatalogPayload = z.input<typeof McpxBoundPayloads.setCatalog>;
export type SavedSetupItem = z.infer<typeof savedSetupItemSchema>;

export interface MockHubServerOptions {
  port: number;
  logger: Logger;
  catalogPayload?: SetCatalogPayload;
  identityPayload?: SetIdentityPayload;
}

export class MockHubServer {
  private io: Server;
  private httpServer: HttpServer;
  private validTokens = new Set<string>();
  private connectedSockets = new Map<string, Socket>();
  private logger: Logger;
  private connectListeners: ((socketId: string) => void)[] = [];
  private disconnectListeners: ((socketId: string) => void)[] = [];
  private listeningPromise: Promise<void>;
  private clientChangeResolvers: (() => void)[] = [];
  private setupChangeMessages: unknown[] = [];
  private setupChangeResolvers: ((message: unknown) => void)[] = [];
  private catalogPayload: SetCatalogPayload | undefined;
  private identityPayload: SetIdentityPayload;
  private savedSetups: Map<string, SavedSetupItem> = new Map();

  constructor(options: MockHubServerOptions) {
    const { port, logger, catalogPayload, identityPayload } = options;
    this.catalogPayload = catalogPayload;
    // Default to member user if not specified
    this.identityPayload = identityPayload ?? {
      entityType: "user",
      role: "member",
    };
    this.logger = logger.child({ component: "MockHubServer" });

    this.httpServer = createServer();
    this.io = new Server(this.httpServer, {
      path: "/v1/ws",
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.setupHandlers();

    this.listeningPromise = new Promise((resolve) => {
      this.httpServer.listen(port, () => {
        this.logger.info(`Mock Hub server listening on port ${port}`);
        resolve();
      });
    });
  }

  setValidTokens(tokens: string[]): void {
    this.validTokens.clear();
    tokens.forEach((token) => this.validTokens.add(token));
    this.logger.info(`Updated valid tokens`, { count: tokens.length });
  }

  /** Emit catalog to all connected clients. Useful after subscribing to ensure catalog is received. */
  emitCatalogToAll(): void {
    if (!this.catalogPayload) {
      this.logger.warn("No catalog payload configured, skipping emit");
      return;
    }
    this.connectedSockets.forEach((socket, socketId) => {
      socket.emit("set-catalog", {
        metadata: { id: "mock-catalog-manual" },
        payload: this.catalogPayload,
      });
      this.logger.info("Emitted set-catalog manually", { socketId });
    });
  }

  /**
   * Emit catalog with an ack callback to test the acknowledgment mechanism.
   * Returns a promise that resolves with the ack result.
   */
  emitCatalogWithAck(
    socketId: string,
    payload?: SetCatalogPayload,
  ): Promise<{ ok: boolean }> {
    const socket = this.connectedSockets.get(socketId);
    if (!socket) {
      return Promise.reject(new Error(`No client ${socketId} was found`));
    }
    const catalogToSend = payload ?? this.catalogPayload;
    if (!catalogToSend) {
      return Promise.reject(new Error("No catalog payload configured"));
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for catalog ack"));
      }, 5000);

      socket.emit(
        "set-catalog",
        {
          metadata: { id: "mock-catalog-with-ack" },
          payload: catalogToSend,
        },
        (ackResult: { ok: boolean }) => {
          clearTimeout(timeout);
          this.logger.info("Received catalog ack", { socketId, ackResult });
          resolve(ackResult);
        },
      );
      this.logger.info("Emitted set-catalog with ack", { socketId });
    });
  }

  getConnectedClients(): string[] {
    return Array.from(this.connectedSockets.keys());
  }

  emitToClient(socketId: string, event: string, data: unknown): void {
    const socket = this.connectedSockets.get(socketId);
    if (!socket) {
      this.logger.warn(
        `Couldn't emit event '${event}': no client ${socketId} was found`,
      );
      return;
    }
    socket.emit(event, data);
    this.logger.info(`Emitted event '${event}' to client`, { socketId });
  }

  onConnect(listener: (socketId: string) => void): void {
    this.connectListeners.push(listener);
  }

  onDisconnect(listener: (socketId: string) => void): void {
    this.disconnectListeners.push(listener);
  }

  disconnectClient(socketId: string): void {
    const socket = this.connectedSockets.get(socketId);
    if (socket) {
      socket.disconnect(true);
      this.logger.info(`Forcefully disconnected client`, { socketId });
    }
  }

  getSetupChangeMessages(): unknown[] {
    return this.setupChangeMessages;
  }

  clearSetupChangeMessages(): void {
    this.setupChangeMessages = [];
  }

  waitForSetupChange(timeoutMs: number = 5000): Promise<unknown> {
    // If we already have a message, return it immediately
    if (this.setupChangeMessages.length > 0) {
      return Promise.resolve(
        this.setupChangeMessages[this.setupChangeMessages.length - 1],
      );
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.setupChangeResolvers.indexOf(resolve);
        if (index > -1) {
          this.setupChangeResolvers.splice(index, 1);
        }
        reject(new Error("Timeout waiting for setup-change message"));
      }, timeoutMs);

      const wrappedResolve = (message: unknown) => {
        clearTimeout(timeoutId);
        resolve(message);
      };
      this.setupChangeResolvers.push(wrappedResolve);
    });
  }

  async waitForListening(): Promise<void> {
    return this.listeningPromise;
  }

  waitForClientChange(): Promise<void> {
    return new Promise((resolve) => {
      this.clientChangeResolvers.push(resolve);
    });
  }

  waitForSpecificClientDisconnect(
    socketId: string,
    timeoutMs: number = 5000,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connectedSockets.has(socketId)) {
        // Already disconnected
        resolve();
        return;
      }

      const cleanup = () => {
        clearTimeout(timeoutId);
        const index = this.disconnectListeners.indexOf(checkDisconnect);
        if (index > -1) {
          this.disconnectListeners.splice(index, 1);
        }
      };

      const checkDisconnect = (disconnectedId: string) => {
        if (disconnectedId === socketId) {
          cleanup();
          resolve();
        }
      };

      // Set timeout to prevent indefinite waiting
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(
          new Error(`Timeout waiting for client ${socketId} to disconnect`),
        );
      }, timeoutMs);

      this.disconnectListeners.push(checkDisconnect);
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      // Force disconnect all connected clients
      this.connectedSockets.forEach((socket) => {
        socket.disconnect(true);
      });
      this.connectedSockets.clear();
      this.connectListeners = [];
      this.disconnectListeners = [];

      // Resolve any pending promises to prevent hanging
      this.clientChangeResolvers.forEach((resolver) => resolver());
      this.clientChangeResolvers = [];

      this.io.close(() => {
        this.httpServer.close(() => {
          console.log("Mock Hub server closed");
          resolve();
        });
      });
    });
  }

  private setupHandlers(): void {
    this.io.use((socket: Socket, next: (err?: Error) => void) => {
      const setupOwnerId = socket.handshake.auth?.["setupOwnerId"];

      this.logger.info("Authentication attempt", {
        socketId: socket.id,
        hasSetupOwnerId: !!setupOwnerId,
      });

      if (!setupOwnerId) {
        this.logger.warn("No setupOwnerId provided", { socketId: socket.id });
        return next(
          new Error("Authentication failed: No setupOwnerId provided"),
        );
      }

      if (!this.validTokens.has(setupOwnerId)) {
        this.logger.warn("Invalid setupOwnerId", { socketId: socket.id });
        return next(new Error("Authentication failed: Invalid setupOwnerId"));
      }

      this.logger.info("Authentication successful", { socketId: socket.id });
      next();
    });

    this.io.on("connection", (socket: Socket) => {
      this.logger.info("Client connected", { socketId: socket.id });
      this.connectedSockets.set(socket.id, socket);

      // Emit identity first, then catalog (like real Hub does)
      socket.emit("set-identity", {
        metadata: { id: "mock-identity-init" },
        payload: this.identityPayload,
      });
      this.logger.info("Emitted set-identity on connection", {
        socketId: socket.id,
        entityType: this.identityPayload.entityType,
      });

      if (this.catalogPayload) {
        socket.emit("set-catalog", {
          metadata: { id: "mock-catalog-init" },
          payload: this.catalogPayload,
        });
        this.logger.info("Emitted set-catalog on connection", {
          socketId: socket.id,
          itemCount: this.catalogPayload.items.length,
        });
      }

      // Notify connect listeners
      this.connectListeners.forEach((listener) => listener(socket.id));

      // Resolve any pending client change promises
      this.clientChangeResolvers.forEach((resolve) => resolve());
      this.clientChangeResolvers = [];

      socket.on("disconnect", (reason: string) => {
        this.logger.info("Client disconnected", {
          socketId: socket.id,
          reason,
        });
        this.connectedSockets.delete(socket.id);

        // Notify disconnect listeners
        this.disconnectListeners.forEach((listener) => listener(socket.id));

        // Resolve any pending client change promises
        this.clientChangeResolvers.forEach((resolve) => resolve());
        this.clientChangeResolvers = [];
      });

      socket.on("error", (error: Error) => {
        this.logger.error("Socket error", { socketId: socket.id, error });
      });

      socket.on("setup-change", (envelope: unknown) => {
        this.logger.info("Received setup-change", { socketId: socket.id });
        this.setupChangeMessages.push(envelope);
        // Notify any waiters
        this.setupChangeResolvers.forEach((resolver) => resolver(envelope));
        this.setupChangeResolvers = [];
      });

      // Saved setups handlers
      socket.on(
        WEBAPP_BOUND_EVENTS.SAVE_SETUP,
        (
          envelope: { payload: SavedSetupItem },
          ack: (res: unknown) => void,
        ) => {
          const { payload } = envelope;
          const id = uuidv7();
          const savedAt = new Date().toISOString();
          const savedSetup: SavedSetupItem = {
            id,
            description: payload.description,
            savedAt,
            targetServers: payload.targetServers,
            config: payload.config,
          };
          this.savedSetups.set(id, savedSetup);
          this.logger.info("Saved setup", {
            id,
            description: payload.description,
          });
          ack({
            success: true,
            savedSetupId: id,
            description: payload.description,
            savedAt,
          });
        },
      );

      socket.on(
        WEBAPP_BOUND_EVENTS.LIST_SAVED_SETUPS,
        (_envelope: unknown, ack: (res: unknown) => void) => {
          const setups = Array.from(this.savedSetups.values());
          this.logger.info("Listing saved setups", { count: setups.length });
          ack({ setups });
        },
      );

      socket.on(
        WEBAPP_BOUND_EVENTS.DELETE_SAVED_SETUP,
        (
          envelope: { payload: { savedSetupId: string } },
          ack: (res: unknown) => void,
        ) => {
          const { savedSetupId } = envelope.payload;
          if (this.savedSetups.has(savedSetupId)) {
            this.savedSetups.delete(savedSetupId);
            this.logger.info("Deleted saved setup", { savedSetupId });
            ack({ success: true });
          } else {
            this.logger.warn("Saved setup not found for deletion", {
              savedSetupId,
            });
            ack({
              success: false,
              error: "Saved setup not found",
              errorCode: "not_found",
            });
          }
        },
      );

      socket.on(
        WEBAPP_BOUND_EVENTS.UPDATE_SAVED_SETUP,
        (
          envelope: {
            payload: {
              savedSetupId: string;
              targetServers: unknown;
              config: unknown;
            };
          },
          ack: (res: unknown) => void,
        ) => {
          const { savedSetupId, targetServers, config } = envelope.payload;
          const existing = this.savedSetups.get(savedSetupId);
          if (existing) {
            const savedAt = new Date().toISOString();
            const updated: SavedSetupItem = {
              ...existing,
              targetServers: targetServers as SavedSetupItem["targetServers"],
              config: config as SavedSetupItem["config"],
              savedAt,
            };
            this.savedSetups.set(savedSetupId, updated);
            this.logger.info("Updated saved setup", { savedSetupId });
            ack({ success: true, savedAt });
          } else {
            this.logger.warn("Saved setup not found for update", {
              savedSetupId,
            });
            ack({
              success: false,
              error: "Saved setup not found",
              errorCode: "not_found",
            });
          }
        },
      );
    });
  }

  getSavedSetups(): SavedSetupItem[] {
    return Array.from(this.savedSetups.values());
  }

  clearSavedSetups(): void {
    this.savedSetups.clear();
  }
}
