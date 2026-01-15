import { Server, Socket } from "socket.io";
import { createServer, Server as HttpServer } from "http";
import { Logger } from "winston";
import { McpxBoundPayloads } from "@mcpx/webapp-protocol/messages";
import z from "zod/v4";

export type SetCatalogPayload = z.input<typeof McpxBoundPayloads.setCatalog>;

export interface MockHubServerOptions {
  port: number;
  logger: Logger;
  catalogPayload?: SetCatalogPayload;
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

  constructor(options: MockHubServerOptions) {
    const { port, logger, catalogPayload } = options;
    this.catalogPayload = catalogPayload;
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

      // Emit catalog on connection (like real Hub does)
      if (this.catalogPayload) {
        socket.emit("set-catalog", {
          metadata: { id: "mock-catalog-init" },
          payload: this.catalogPayload,
        });
        this.logger.info("Emitted set-catalog on connection", {
          socketId: socket.id,
          isStrict: this.catalogPayload.isStrict,
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
    });
  }
}
