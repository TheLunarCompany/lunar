import { io, Socket } from "socket.io-client";
import { Logger } from "winston";
import { env } from "../env.js";
import { Watched } from "@mcpx/toolkit-core/app";
import { makeError } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { promises as fsPromises } from "fs";
import z from "zod/v4";

export class HubConnectionError extends Error {
  name = "HubConnectionError";

  toJSON(): { name: string; message: string; causeMessage?: string } {
    return {
      name: this.name,
      message: this.message,
      causeMessage: this.causeMessage,
    };
  }

  private get causeMessage(): string | undefined {
    if (this.cause instanceof Error) {
      return this.cause.message;
    }
    return undefined;
  }
}

export class HubUnavailableError extends HubConnectionError {
  name = "HubUnavailableError";
}

export class HubConnectionTimeoutError extends HubConnectionError {
  name = "HubConnectionTimeoutError";
  toJSON(): { name: string; message: string } {
    return {
      name: this.name,
      message: this.message,
    };
  }
}

export interface AuthStatus {
  status: "unauthenticated" | "authenticated";
  connectionError?: HubConnectionError;
}

const authStatusEqualFn = (a: AuthStatus, b: AuthStatus): boolean => {
  if (a.status !== b.status) return false;
  return a.connectionError?.name === b.connectionError?.name;
};

const CONNECTION_TIMEOUT_MS = 10_000;

export interface HubServiceOptions {
  hubUrl?: string;
  authTokensDir?: string;
  connectionTimeout?: number;
}

export class HubService {
  private _status = new Watched<AuthStatus>(
    { status: "unauthenticated" },
    authStatusEqualFn,
  );
  private logger: Logger;
  private socket: Socket | null = null;
  private connectionPromise: {
    resolve: (value: void) => void;
    reject: (reason: Error) => void;
  } | null = null;
  private connectionTimeoutId: NodeJS.Timeout | null = null;
  private readonly hubUrl: string;
  private readonly authTokensDir: string;
  private readonly connectionTimeout: number;

  constructor(logger: Logger, options: HubServiceOptions = {}) {
    this.logger = logger.child({ component: "HubService" });
    this.hubUrl = options.hubUrl ?? env.HUB_WS_URL;
    this.authTokensDir = options.authTokensDir ?? env.AUTH_TOKENS_DIR;
    this.connectionTimeout = options.connectionTimeout ?? CONNECTION_TIMEOUT_MS;
  }

  get status(): AuthStatus {
    return this._status.get();
  }

  addStatusListener(listener: (status: AuthStatus) => void): void {
    this._status.addListener(listener);
  }

  async initialize(): Promise<void> {
    await this.connect();
  }
  async connect(suppliedAuthToken?: string): Promise<AuthStatus> {
    let authToken: string;
    if (!suppliedAuthToken) {
      this.logger.info(
        "No auth token provided, trying to read persisted token",
      );
      const persistedAuthToken = await this.readPersistedToken();
      if (!persistedAuthToken) {
        this.logger.warn("No persisted token found, cannot connect to Hub");
        return { status: "unauthenticated" };
      }
      authToken = persistedAuthToken;
    } else {
      authToken = suppliedAuthToken;
    }

    if (this.socket) {
      this.logger.info(
        "Connection to Hub already established, disconnecting first",
      );
      this.socket.disconnect();
      this.socket = null;
    }

    this.logger.info("Connecting to Hub with authentication");
    this.socket = io(this.hubUrl, {
      path: "/v1/ws",
      auth: { token: authToken, version: env.VERSION },
      reconnection: false,
      timeout: this.connectionTimeout,
    });

    this.setupEventHandlers();

    try {
      await this.waitForConnection();
      if (this.status.status === "authenticated") {
        await this.persistSuccessfulToken(authToken);
      }
      this.logger.info("Returning status", { status: this.status.status });
      return this._status.get();
    } catch (error) {
      this.logger.error("Connection failed", { error });
      return this._status.get();
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.logger.info("Disconnecting from Hub");
      this.socket.disconnect();
      this.socket = null;
    }
    await this.deletePersistedToken();
    this._status.set({ status: "unauthenticated" });
  }

  private async waitForConnection(): Promise<void> {
    return Promise.race([
      new Promise<void>((resolve, reject) => {
        this.connectionPromise = { resolve, reject };
      }),
      new Promise<void>((_, reject) => {
        this.connectionTimeoutId = setTimeout(() => {
          this.logger.error("Hub connection timed out, giving up");
          if (this.socket) {
            this.socket.close();
            this.socket = null;
          }
          this._status.set({
            status: "unauthenticated",
            connectionError: new HubConnectionTimeoutError(
              "Connection timed out",
            ),
          });
          reject(new Error("Connection timeout"));
        }, this.connectionTimeout);
      }),
    ]);
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.logger.info("Connected to Hub");
      this._status.set({ status: "authenticated" });
      this.resolveConnection();
    });

    this.socket.on("connect_error", (e) => {
      const error = makeError(e);
      this.logger.error("Failed to connect to Hub", loggableError(error));
      this._status.set({
        status: "unauthenticated",
        connectionError: new HubUnavailableError("Failed to connect to hub", {
          cause: error,
        }),
      });
      this.rejectConnection(error);
    });
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }

  private resolveConnection(): void {
    this.clearConnectionTimeout();
    if (this.connectionPromise) {
      this.connectionPromise.resolve();
      this.connectionPromise = null;
    }
  }

  private rejectConnection(error: Error): void {
    this.clearConnectionTimeout();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.connectionPromise) {
      this.connectionPromise.reject(error);
      this.connectionPromise = null;
    }
  }

  private persistedTokenSchema = z.object({ token: z.string() });
  private async persistSuccessfulToken(token: string): Promise<void> {
    const dir = `${this.authTokensDir}/mcpx-hub`;
    try {
      await fsPromises.mkdir(dir, { recursive: true });
      const filePath = `${dir}/hub-token.json`;
      await fsPromises.writeFile(
        filePath,
        JSON.stringify(this.persistedTokenSchema.parse({ token }), null, 2),
        "utf8",
      );
    } catch (error) {
      this.logger.error("Failed to persist Hub token", {
        error: loggableError(error),
      });
    }
  }

  private async readPersistedToken(): Promise<string | null> {
    const filePath = `${this.authTokensDir}/mcpx-hub/hub-token.json`;
    try {
      const data = await fsPromises.readFile(filePath, "utf8");
      const parsed = JSON.parse(data);
      const result = this.persistedTokenSchema.parse(parsed);
      return result.token;
    } catch (error) {
      this.logger.debug(
        "Cannot reuse persisted Hub token",
        loggableError(error),
      );
      return null;
    }
  }

  private async deletePersistedToken(): Promise<void> {
    const filePath = `${this.authTokensDir}/mcpx-hub/hub-token.json`;
    try {
      await fsPromises.unlink(filePath);
      this.logger.info("Deleted persisted Hub token");
    } catch (error) {
      this.logger.error("Failed to delete persisted Hub token", {
        error: loggableError(error),
      });
    }
  }
}
