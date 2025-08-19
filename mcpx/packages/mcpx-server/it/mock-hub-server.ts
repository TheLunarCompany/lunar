import { Server, Socket } from "socket.io";
import { createServer, Server as HttpServer } from "http";
import { Logger } from "winston";

export interface MockHubServerOptions {
  port: number;
  logger: Logger;
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

  constructor(options: MockHubServerOptions) {
    const { port, logger } = options;
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

  getConnectedClients(): string[] {
    return Array.from(this.connectedSockets.keys());
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
          this.logger.info("Mock Hub server closed");
          resolve();
        });
      });
    });
  }

  private setupHandlers(): void {
    this.io.use((socket: Socket, next: (err?: Error) => void) => {
      const token = socket.handshake.auth?.["token"];

      this.logger.info("Authentication attempt", {
        socketId: socket.id,
        hasToken: !!token,
      });

      if (!token) {
        this.logger.warn("No token provided", { socketId: socket.id });
        return next(new Error("Authentication failed: No token provided"));
      }

      if (!this.validTokens.has(token)) {
        this.logger.warn("Invalid token", { socketId: socket.id });
        return next(new Error("Authentication failed: Invalid token"));
      }

      this.logger.info("Authentication successful", { socketId: socket.id });
      next();
    });

    this.io.on("connection", (socket: Socket) => {
      this.logger.info("Client connected", { socketId: socket.id });
      this.connectedSockets.set(socket.id, socket);

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
    });
  }
}
