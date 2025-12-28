import { Watched } from "@mcpx/toolkit-core/app";
import { makeError } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import {
  McpxBoundPayloads,
  safeParseEnvelopedMessage,
  WebappBoundEventName,
  WebappBoundPayloadOf,
  wrapInEnvelope,
} from "@mcpx/webapp-protocol/messages";
import { io, Socket } from "socket.io-client";
import { Logger } from "winston";
import { env } from "../env.js";
import { Config } from "../model/config/config.js";
import { TargetServer } from "../model/target-servers.js";
import { SetupManagerI } from "./setup-manager.js";
import { ThrottledSender } from "./throttled-sender.js";
import { UsageStatsSender } from "./usage-stats-sender.js";
import { CatalogManagerI } from "./catalog-manager.js";

// Minimal interfaces for HubService dependencies
export interface ConfigServiceForHub {
  registerPostCommitHook(
    hook: (committedConfig: Config) => Promise<void>,
  ): void;
}

export interface TargetClientsForHub {
  registerPostChangeHook(hook: (servers: TargetServer[]) => void): void;
}

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

const CONNECTION_TIMEOUT_MS = 20_000;

const envelopedApplySetupSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.applySetup,
);

const envelopedLoadCatalogSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.setCatalog,
);

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
  private readonly connectionTimeout: number;
  private readonly setupChangeSender: ThrottledSender;
  private readonly usageStatsSender: UsageStatsSender;
  private readonly setupManager: SetupManagerI;
  private readonly catalogManager: CatalogManagerI;
  private readonly configService: ConfigServiceForHub;
  private readonly targetClients: TargetClientsForHub;

  constructor(
    logger: Logger,
    setupManager: SetupManagerI,
    catalogManager: CatalogManagerI,
    configService: ConfigServiceForHub,
    targetClients: TargetClientsForHub,
    getUsageStats: () => WebappBoundPayloadOf<"usage-stats">,
    options: HubServiceOptions = {},
  ) {
    this.logger = logger.child({ component: "HubService" });
    this.setupManager = setupManager;
    this.catalogManager = catalogManager;
    this.configService = configService;
    this.targetClients = targetClients;
    this.hubUrl = options.hubUrl ?? env.HUB_WS_URL;
    this.connectionTimeout = options.connectionTimeout ?? CONNECTION_TIMEOUT_MS;

    const createSender =
      (eventName: WebappBoundEventName) =>
      (_key: string, payload: unknown, correlationId?: string): void => {
        if (!this.socket || this.status.status !== "authenticated") {
          this.logger.debug("Cannot send message, not connected to Hub");
          return;
        }
        // TODO MCP-471: refactor wrapInEnvelope to accept props object
        const envelopedMessage = wrapInEnvelope(
          payload,
          undefined,
          correlationId,
        );
        this.logger.debug("Sending enveloped message to Hub", {
          eventName,
          messageId: envelopedMessage.metadata.id,
        });
        this.socket.emit(eventName, envelopedMessage);
      };

    this.setupChangeSender = new ThrottledSender(createSender("setup-change"));
    this.usageStatsSender = new UsageStatsSender(
      logger.child({ component: "UsageStatsSender" }),
      getUsageStats,
      env.USAGE_STATS_INTERVAL_MS,
    );
  }

  get status(): AuthStatus {
    return this._status.get();
  }

  addStatusListener(listener: (status: AuthStatus) => void): void {
    this._status.addListener(listener);
  }

  async initialize(): Promise<void> {
    // Wire hooks to send setup changes to Hub
    // These are suppressed during digest operations in SetupManager because we will want to
    // send a single consolidated change after the digest is done, representing the final state and that
    // it was a "digest" operation (source = "hub").
    this.configService.registerPostCommitHook(
      (committedConfig: Config): Promise<void> => {
        if (this.setupManager.isDigesting()) {
          return Promise.resolve();
        }
        const payload =
          this.setupManager.buildUserConfigChangePayload(committedConfig);
        if (payload) {
          this.sendThrottledSetupChange(payload);
        }
        return Promise.resolve();
      },
    );

    this.targetClients.registerPostChangeHook((servers: TargetServer[]) => {
      if (this.setupManager.isDigesting()) {
        return;
      }
      const payload =
        this.setupManager.buildUserTargetServersChangePayload(servers);
      if (payload) {
        this.sendThrottledSetupChange(payload);
      }
    });

    await this.connect({
      setupOwnerId: env.INSTANCE_KEY,
      label: env.INSTANCE_NAME,
    });
  }

  async connect(props: {
    setupOwnerId?: string;
    label?: string;
  }): Promise<AuthStatus> {
    const { setupOwnerId, label } = props;
    if (!setupOwnerId) {
      this.logger.error("Cannot connect to Hub: setupOwnerId is not provided");
      return {
        status: "unauthenticated",
        connectionError: new HubConnectionError(
          "setupOwnerId is required to connect to Hub",
        ),
      };
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
      transports: ["websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      auth: {
        setupOwnerId,
        label,
        version: env.VERSION,
      },
      timeout: this.connectionTimeout,
    });

    this.setupEventHandlers();

    try {
      await this.waitForConnection();
      this.logger.info("Returning status", { status: this.status.status });
      return this._status.get();
    } catch (error) {
      this.logger.error("Connection failed", { error });
      return this._status.get();
    }
  }

  async shutdown(): Promise<void> {
    await this.disconnect();
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.logger.info("Disconnecting from Hub");
      this.socket.disconnect();
      this.socket = null;
    }
    this.usageStatsSender.stop();
    this.setupChangeSender.shutdown();
    this._status.set({ status: "unauthenticated" });
  }

  sendThrottledSetupChange(
    payload: WebappBoundPayloadOf<"setup-change">,
  ): void {
    this.setupChangeSender.send("setup-change", payload);
  }

  sendImmediateSetupChange(
    payload: WebappBoundPayloadOf<"setup-change">,
    correlationId?: string,
  ): void {
    this.setupChangeSender.sendNow("setup-change", payload, correlationId);
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
      if (this.socket) {
        this.usageStatsSender.start(this.socket);
      }
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

      // socket.active indicates if automatic reconnection will occur
      if (this.socket && !this.socket.active) {
        // No automatic reconnection will happen - clean up
        this.logger.info("No automatic reconnection after connect_error");
        this.rejectConnection(error);
      }
      // Otherwise socket.io will handle reconnection automatically
    });

    this.socket.on("disconnect", (reason, details) => {
      this.logger.info("Disconnected from Hub", { reason, details });
      this.usageStatsSender.stop();
      this._status.set({
        status: "unauthenticated",
        connectionError: new HubConnectionError(
          `Disconnected from Hub: ${reason}`,
        ),
      });

      // socket.active indicates if automatic reconnection will occur
      if (this.socket && !this.socket.active) {
        // No automatic reconnection will happen - clean up
        this.logger.info("No automatic reconnection, cleaning up", { reason });
        this.rejectConnection(new Error(`Disconnected: ${reason}`));
      }
      // Otherwise socket.io will handle reconnection automatically
    });

    this.socket.on("apply-setup", async (envelope) => {
      try {
        const parseResult = envelopedApplySetupSafeParse(envelope);
        if (!parseResult.success) {
          this.logger.error("Failed to parse apply-setup message", {
            error: parseResult.error,
            envelope,
          });
          return;
        }
        const metadata = parseResult.data.metadata;
        const message = parseResult.data.payload;
        const correlationId = metadata.correlationId;
        this.logger.info("Received apply-setup message from Hub", {
          source: message.source,
          setupId: message.setupId,
          correlationId,
        });

        // Apply setup and get the resulting payload to send back
        const setupChangePayload = await this.setupManager.applySetup(message);
        this.sendImmediateSetupChange(setupChangePayload, correlationId);
        this.logger.info("Sent setup-change response to Hub", {
          source: setupChangePayload.source,
          correlationId,
        });
      } catch (e) {
        this.logger.error("Failed to handle apply-setup", {
          ...loggableError(e),
          envelope,
        });
      }
    });

    this.socket.on("set-catalog", async (envelope) => {
      try {
        const parseResult = envelopedLoadCatalogSafeParse(envelope);
        if (!parseResult.success) {
          this.logger.error("Failed to parse set-catalog message", {
            error: parseResult.error,
            envelope,
          });
          return;
        }
        const metadata = parseResult.data.metadata;
        const message = parseResult.data.payload;
        const id = metadata.id;
        this.logger.info("Received set-catalog message from Hub", {
          serverCount: message.servers.length,
          serverNames: message.servers.map((s) => s.name),
          messageId: id,
        });

        // Load the catalog into the catalog manager attribute used for local storage
        this.catalogManager.setCatalog(message);
      } catch (e) {
        this.logger.error("Failed to handle set-catalog", {
          ...loggableError(e),
          envelope,
        });
      }
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
}
