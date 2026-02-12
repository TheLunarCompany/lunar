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
import { SavedSetupsClient, SavedSetupsSocket } from "./saved-setups-client.js";
import { io, Socket } from "socket.io-client";
import { Logger } from "winston";
import { env } from "../env.js";
import { Config } from "../model/config/config.js";
import { TargetServer } from "../model/target-servers.js";
import { CatalogManagerI } from "./catalog-manager.js";
import { IdentityServiceI } from "./identity-service.js";
import { SetupManagerI } from "./setup-manager.js";
import {
  UpstreamHandlerOAuthHandler,
  TargetServerChangeNotifier,
} from "./upstream-handler.js";
import { ThrottledSender } from "./throttled-sender.js";
import { UsageStatsSender } from "./usage-stats-sender.js";

// Minimal interfaces for HubService dependencies
export interface ConfigServiceForHub {
  registerPostCommitHook(
    hook: (committedConfig: Config) => Promise<void>,
  ): void;
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
const ACK_TIMEOUT_MS = 10_000;

const EXPECTED_BOOT_PHASE_ORDER: BootPhase[] = [
  "disconnected",
  "connected",
  "identity-received",
  "catalog-received",
  "setup-received",
];

function isSorted(arr: number[]): boolean {
  return arr.every((v, i, a) => i === 0 || v >= a[i - 1]!);
}

function isValidPhaseSequence(phases: BootPhase[]): boolean {
  const orderIndices = phases.map((phase) =>
    EXPECTED_BOOT_PHASE_ORDER.indexOf(phase),
  );
  return isSorted(orderIndices);
}

const envelopedApplySetupSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.applySetup,
);

const envelopedLoadCatalogSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.setCatalog,
);

const envelopedInitiateOAuthSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.initiateOAuth,
);

const envelopedCompleteOAuthSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.completeOAuth,
);

const envelopedSetIdentitySafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.setIdentity,
);

export interface HubServiceOptions {
  hubUrl?: string;
  authTokensDir?: string;
  connectionTimeout?: number;
}

export type BootPhase =
  | "disconnected"
  | "connected"
  | "identity-received"
  | "catalog-received"
  | "setup-received";

export interface BootPhaseEntry {
  phase: BootPhase;
  timestamp: Date;
}

export class HubService {
  private _status = new Watched<AuthStatus>(
    { status: "unauthenticated" },
    authStatusEqualFn,
  );
  private bootPhaseHistory: BootPhaseEntry[] = [
    { phase: "disconnected", timestamp: new Date() },
  ];
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
  private readonly identityService: IdentityServiceI;
  private readonly upstreamHandler: TargetServerChangeNotifier &
    UpstreamHandlerOAuthHandler;
  readonly savedSetups: SavedSetupsClient;

  constructor(
    logger: Logger,
    setupManager: SetupManagerI,
    catalogManager: CatalogManagerI,
    configService: ConfigServiceForHub,
    identityService: IdentityServiceI,
    upstreamHandler: TargetServerChangeNotifier & UpstreamHandlerOAuthHandler,
    getUsageStats: () => WebappBoundPayloadOf<"usage-stats">,
    options: HubServiceOptions = {},
  ) {
    this.logger = logger.child({ component: "HubService" });
    this.setupManager = setupManager;
    this.catalogManager = catalogManager;
    this.configService = configService;
    this.identityService = identityService;
    this.upstreamHandler = upstreamHandler;
    this.hubUrl = options.hubUrl ?? env.HUB_WS_URL;
    this.connectionTimeout = options.connectionTimeout ?? CONNECTION_TIMEOUT_MS;

    const createSender =
      (eventName: WebappBoundEventName) =>
      (_key: string, payload: unknown, correlationId?: string): void => {
        if (!this.socket || this.status.status !== "authenticated") {
          this.logger.debug("Cannot send message, not connected to Hub");
          return;
        }
        const envelopedMessage = wrapInEnvelope({ payload, correlationId });
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
    this.savedSetups = new SavedSetupsClient(
      () => this.createSavedSetupsSocketAdapter(),
      logger,
    );
  }

  private createSavedSetupsSocketAdapter(): SavedSetupsSocket | null {
    if (!this.socket || this.status.status !== "authenticated") {
      return null;
    }
    const socket = this.socket;
    return {
      emitWithAck: (event, envelope) =>
        socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, envelope), // TODO can this be better typed?
    };
  }

  get status(): AuthStatus {
    return this._status.get();
  }

  addStatusListener(listener: (status: AuthStatus) => void): void {
    this._status.addListener(listener);
  }

  get latestBootPhase(): BootPhase {
    const sorted = this.bootPhaseHistorySnapshot;
    return sorted[sorted.length - 1]?.phase ?? "disconnected";
  }

  get bootPhaseHistorySnapshot(): BootPhaseEntry[] {
    return [...this.bootPhaseHistory].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
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

    this.upstreamHandler.registerPostChangeHook(
      "hub-target-servers-change",
      (servers: TargetServer[]) => {
        // Send usage stats whenever target servers change (connect/disconnect)
        if (this.socket) {
          this.usageStatsSender.sendNow(this.socket);
        }

        if (this.setupManager.isDigesting()) {
          return;
        }
        const payload =
          this.setupManager.buildUserTargetServersChangePayload(servers);
        if (payload) {
          this.sendThrottledSetupChange(payload);
        }
      },
    );

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
    if (
      this.socket?.connected &&
      this._status.get().status === "authenticated"
    ) {
      this.logger.info("Already connected to Hub, returning existing status");
      return this._status.get();
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
      this.transitionBootPhase("connected");
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
        this.transitionBootPhase("setup-received");
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

    this.socket.on(
      "set-catalog",
      async (envelope, ack?: (res: { ok: boolean }) => void) => {
        try {
          const parseResult = envelopedLoadCatalogSafeParse(envelope);
          if (!parseResult.success) {
            this.logger.error("Failed to parse set-catalog message", {
              error: parseResult.error,
              envelope,
            });
            ack?.({ ok: false });
            return;
          }
          const metadata = parseResult.data.metadata;
          const message = parseResult.data.payload;
          const id = metadata.id;
          this.logger.info("Received set-catalog message from Hub", {
            serverCount: message.items.length,
            serverNames: message.items.map((i) => i.server.name),
            messageId: id,
          });

          // Load the catalog into the catalog manager attribute used for local storage
          this.catalogManager.setCatalog(message);
          this.transitionBootPhase("catalog-received");
          ack?.({ ok: true });
        } catch (e) {
          this.logger.error("Failed to handle set-catalog", {
            ...loggableError(e),
            envelope,
          });
          ack?.({ ok: false });
        }
      },
    );

    this.socket.on(
      "set-identity",
      (envelope, ack?: (res: { ok: boolean }) => void) => {
        try {
          const parseResult = envelopedSetIdentitySafeParse(envelope);
          if (!parseResult.success) {
            this.logger.error("Failed to parse set-identity message", {
              error: parseResult.error,
              envelope,
            });
            ack?.({ ok: false });
            return;
          }
          const message = parseResult.data.payload;
          this.logger.info("Received set-identity message from Hub", {
            entityType: message.entityType,
            role: message.entityType === "user" ? message.role : undefined,
          });

          this.identityService.setIdentity(message);
          this.transitionBootPhase("identity-received");
          ack?.({ ok: true });
        } catch (e) {
          this.logger.error("Failed to handle set-identity", {
            ...loggableError(e),
            envelope,
          });
          ack?.({ ok: false });
        }
      },
    );

    this.socket.on("initiate-oauth", async (envelope) => {
      try {
        const parseResult = envelopedInitiateOAuthSafeParse(envelope);
        if (!parseResult.success) {
          this.logger.error("Failed to parse initiate-oauth message", {
            error: parseResult.error,
            envelope,
          });
          return;
        }
        const metadata = parseResult.data.metadata;
        const message = parseResult.data.payload;
        const correlationId = metadata.correlationId;
        this.logger.info("Received initiate-oauth message from Hub", {
          serverName: message.serverName,
          correlationId,
        });

        const result = await this.upstreamHandler.initiateOAuthForServer(
          message.serverName,
          message.callbackUrl,
        );

        // Send oauth-authorization-required response back to Hub
        const responsePayload = {
          serverName: message.serverName,
          authorizationUrl: result.authorizationUrl,
          state: result.state,
          userCode: result.userCode,
        };
        const envelopedResponse = wrapInEnvelope({
          payload: responsePayload,
          correlationId,
        });
        this.socket?.emit("oauth-authorization-required", envelopedResponse);
        this.logger.debug("Sent oauth-authorization-required response to Hub", {
          serverName: message.serverName,
          correlationId,
        });
      } catch (e) {
        this.logger.error("Failed to handle initiate-oauth", {
          ...loggableError(e),
          envelope,
        });
      }
    });

    this.socket.on("complete-oauth", async (envelope) => {
      try {
        const parseResult = envelopedCompleteOAuthSafeParse(envelope);
        if (!parseResult.success) {
          this.logger.error("Failed to parse complete-oauth message", {
            error: parseResult.error,
            envelope,
          });
          return;
        }
        const message = parseResult.data.payload;
        this.logger.info("Received complete-oauth message from Hub", {
          serverName: message.serverName,
        });

        await this.upstreamHandler.completeOAuthByState(
          message.state,
          message.authorizationCode,
        );
        this.logger.info("OAuth flow completed", {
          serverName: message.serverName,
        });
      } catch (e) {
        this.logger.error("Failed to handle complete-oauth", {
          ...loggableError(e),
          envelope,
        });
      }
    });
  }

  private transitionBootPhase(newPhase: BootPhase): void {
    const previousPhase = this.latestBootPhase;
    this.bootPhaseHistory.push({ phase: newPhase, timestamp: new Date() });

    const phases = this.bootPhaseHistorySnapshot.map((entry) => entry.phase);
    if (!isValidPhaseSequence(phases)) {
      this.logger.warn("Boot phase sequence out of order", {
        previousPhase,
        newPhase,
        history: phases,
      });
    }

    this.logger.info("Boot phase transitioned", {
      from: previousPhase,
      to: newPhase,
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
