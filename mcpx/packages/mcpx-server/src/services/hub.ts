import { Watched } from "@mcpx/toolkit-core/app";
import { makeError } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import {
  Ack,
  DynamicCapabilitiesMatchingAck,
  DynamicCapabilitiesMatchingPayload,
  dynamicCapabilitiesMatchingAckSchema,
  McpxBoundPayloads,
  safeParseEnvelopedMessage,
  SetPersonalSkillsPayload,
  WEBAPP_BOUND_EVENTS,
  WebappBoundEventName,
  WebappBoundPayloadOf,
  wrapInEnvelope,
} from "@mcpx/webapp-protocol/messages";
import { HubSocketAdapter, SavedSetupsClient } from "./saved-setups-client.js";
import { io, Socket } from "socket.io-client";
import { Logger } from "winston";
import { env } from "../env.js";
import { Config } from "../model/config/config.js";
import { TargetServer } from "../model/target-servers.js";
import { CatalogManagerI } from "./catalog-manager.js";
import { IdentityServiceI } from "./identity-service.js";
import { SetupManagerI } from "./setup-manager.js";
import { EnvVarManager } from "./env-var-manager.js";
import {
  UpstreamHandlerOAuthHandler,
  TargetServerChangeNotifier,
} from "./upstream-handler.js";
import { ThrottledSender } from "./throttled-sender.js";
import { createToolCallBatcher, ToolCallBatcher } from "./tool-call-batcher.js";
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

export interface AuthStatus {
  status: "unauthenticated" | "authenticated";
  connectionError?: HubConnectionError;
}

const authStatusEqualFn = (a: AuthStatus, b: AuthStatus): boolean => {
  if (a.status !== b.status) return false;
  return a.connectionError?.name === b.connectionError?.name;
};

const ACK_TIMEOUT_MS = 10_000;
// Reconnect backoff base + jitter (the cap is env-tunable via
// HUB_RECONNECT_DELAY_MAX_MS). Jitter, not a big cap, spreads the fleet out.
const HUB_RECONNECT_DELAY_MS = 1_000;
const HUB_RECONNECT_RANDOMIZATION_FACTOR = 0.5;

// Step number per phase. Phases with the same step can arrive in either order
// without violating the sequence — used for the two env-var buckets
// (profile-secrets and oauth-credentials) which travel on independent wire
// events and may land in any order.
const PHASE_STEP: Record<BootPhase, number> = {
  disconnected: 0,
  connected: 1,
  "identity-received": 2,
  "catalog-received": 3,
  "profile-secrets-received": 4,
  "oauth-credentials-received": 4,
  "setup-received": 5,
};

function isSorted(arr: number[]): boolean {
  return arr.every((v, i, a) => {
    if (i === 0) return true;
    const prev = a[i - 1];
    return prev !== undefined && v >= prev;
  });
}

function isValidPhaseSequence(phases: BootPhase[]): boolean {
  return isSorted(phases.map((phase) => PHASE_STEP[phase]));
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

const envelopedSetProfileSecretsSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.setProfileSecrets,
);

const envelopedSetOauthCredentialsSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.setOauthCredentials,
);

const envelopedSetPersonalSkillsSafeParse = safeParseEnvelopedMessage(
  McpxBoundPayloads.setPersonalSkills,
);

export interface HubServiceOptions {
  hubUrl?: string;
  authTokensDir?: string;
  connectionTimeout?: number;
  reconnectionDelayMax?: number;
  toolCallBatchIntervalMs?: number;
}

export type BootPhase =
  | "disconnected"
  | "connected"
  | "identity-received"
  | "catalog-received"
  | "profile-secrets-received"
  | "oauth-credentials-received"
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
  // Re-arm: socket.io retries transport errors, but gives up on a handshake
  // rejection (socket.active === false). This retries that case, which is
  // usually transient (not yet provisioned, token rotation, Hub restarting).
  private reArmTimeoutId: NodeJS.Timeout | null = null;
  private reArmAttempts = 0;
  private isShuttingDown = false;
  // True only while disconnect() is mid-teardown; connect() no-ops during it.
  private disconnecting = false;
  private lastConnectProps: { setupOwnerId?: string; label?: string } | null =
    null;
  private readonly hubUrl: string;
  private readonly connectionTimeout: number;
  private readonly reconnectionDelayMax: number;
  private readonly setupChangeSender: ThrottledSender;
  private readonly usageStatsSender: UsageStatsSender;
  private readonly toolCallBatcher: ToolCallBatcher;
  private readonly setupManager: SetupManagerI;
  private readonly catalogManager: CatalogManagerI;
  private readonly envVarManager: EnvVarManager;
  private readonly configService: ConfigServiceForHub;
  private readonly identityService: IdentityServiceI;
  private readonly upstreamHandler: TargetServerChangeNotifier &
    UpstreamHandlerOAuthHandler;
  private readonly personalSkillsListeners = new Set<
    (payload: SetPersonalSkillsPayload) => void
  >();
  readonly savedSetups: SavedSetupsClient;

  constructor(
    logger: Logger,
    setupManager: SetupManagerI,
    catalogManager: CatalogManagerI,
    envVarManager: EnvVarManager,
    configService: ConfigServiceForHub,
    identityService: IdentityServiceI,
    upstreamHandler: TargetServerChangeNotifier & UpstreamHandlerOAuthHandler,
    getUsageStats: () => WebappBoundPayloadOf<"usage-stats">,
    options: HubServiceOptions = {},
  ) {
    this.logger = logger.child({ component: "HubService" });
    this.setupManager = setupManager;
    this.catalogManager = catalogManager;
    this.envVarManager = envVarManager;
    this.configService = configService;
    this.identityService = identityService;
    this.upstreamHandler = upstreamHandler;
    this.hubUrl = options.hubUrl ?? env.HUB_WS_URL;
    this.connectionTimeout =
      options.connectionTimeout ?? env.HUB_CONNECTION_TIMEOUT_MS;
    this.reconnectionDelayMax =
      options.reconnectionDelayMax ?? env.HUB_RECONNECT_DELAY_MAX_MS;

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
    this.toolCallBatcher = createToolCallBatcher({
      logger: logger.child({ component: "ToolCallBatcher" }),
      intervalMs:
        options.toolCallBatchIntervalMs ?? env.TOOL_CALL_BATCH_INTERVAL_MS,
      getSocket: () => this.socket,
    });
    this.savedSetups = new SavedSetupsClient(
      () => this.getSocketAdapter(),
      logger,
    );
  }

  getSocketAdapter(): HubSocketAdapter | null {
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

  addPersonalSkillsListener(
    listener: (payload: SetPersonalSkillsPayload) => void,
  ): void {
    this.personalSkillsListeners.add(listener);
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
    // Idempotent fire-and-forget: ensure a socket exists, return current status.
    // Callers observe status; reconnection runs in the background (socket.io for
    // transport, re-arm for handshake rejection).
    // A teardown is in flight; don't race it. The next connect() reconnects.
    if (this.disconnecting) {
      return this._status.get();
    }
    this.lastConnectProps = props;
    this.isShuttingDown = false;

    // A socket already exists: no-op, and crucially leave any pending re-arm
    // running — cancelling it here would strand a handshake-rejected instance.
    if (this.socket) {
      return this._status.get();
    }

    // Building a fresh socket, so drop any pending re-arm (this attempt replaces it).
    this.clearReArmTimer();
    this.logger.info("Connecting to Hub with authentication");
    this.socket = io(this.hubUrl, {
      path: "/v1/ws",
      transports: ["websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: HUB_RECONNECT_DELAY_MS,
      reconnectionDelayMax: this.reconnectionDelayMax,
      randomizationFactor: HUB_RECONNECT_RANDOMIZATION_FACTOR,
      auth: {
        setupOwnerId,
        label,
        version: env.VERSION,
      },
      timeout: this.connectionTimeout,
    });

    this.setupEventHandlers();
    return this._status.get();
  }

  async shutdown(): Promise<void> {
    await this.disconnect();
  }

  async disconnect(): Promise<void> {
    // Explicit teardown: stop the re-arm so it doesn't reconnect us.
    this.isShuttingDown = true;
    // Guard the async teardown: a connect() racing the awaits below would
    // otherwise no-op on the still-present socket and then we'd null it,
    // stranding the instance. While disconnecting, connect() is a no-op.
    this.disconnecting = true;
    this.clearReArmTimer();
    this.reArmAttempts = 0;
    this.usageStatsSender.stop();
    try {
      await this.toolCallBatcher.shutdown();
      this.setupChangeSender.shutdown();
      if (this.socket) {
        this.logger.info("Disconnecting from Hub");
        // Allow the event loop to drain any pending socket.io writes before closing
        await new Promise<void>((resolve) => setImmediate(resolve));
        this.socket.disconnect();
        this.socket = null;
      }
      this._status.set({ status: "unauthenticated" });
    } finally {
      this.disconnecting = false;
    }
  }

  sendThrottledSetupChange(
    payload: WebappBoundPayloadOf<"setup-change">,
  ): void {
    this.setupChangeSender.send("setup-change", payload);
  }

  recordToolCall(params: {
    serverName: string;
    toolName: string;
    clientName: string | undefined;
    consumerTag: string | undefined;
    durationMs: number;
    isError: boolean;
    isCallFailure: boolean;
  }): void {
    const errorType = params.isError
      ? params.isCallFailure
        ? "call_failed"
        : "tool_error"
      : null;

    this.toolCallBatcher.add([
      {
        timestamp: new Date(),
        serverName: params.serverName,
        toolName: params.toolName,
        clientName: params.clientName,
        consumerTag: params.consumerTag,
        durationMs: params.durationMs,
        errorType,
      },
    ]);
  }

  sendImmediateSetupChange(
    payload: WebappBoundPayloadOf<"setup-change">,
    correlationId?: string,
  ): void {
    this.setupChangeSender.sendNow("setup-change", payload, correlationId);
  }

  async emitDynamicCapabilitiesMatching(
    payload: DynamicCapabilitiesMatchingPayload,
  ): Promise<DynamicCapabilitiesMatchingAck> {
    if (!this.socket || this.status.status !== "authenticated") {
      return { status: "error", error: "Not connected to Hub" };
    }
    const envelope = wrapInEnvelope({ payload });
    this.logger.debug("Sending dynamic-capabilities-matching to Hub", {
      messageId: envelope.metadata.id,
    });
    try {
      const ack = await this.socket
        .timeout(env.LLM_REQUEST_TIMEOUT_MS)
        .emitWithAck(
          WEBAPP_BOUND_EVENTS.DYNAMIC_CAPABILITIES_MATCHING,
          envelope,
        );
      const parsed = dynamicCapabilitiesMatchingAckSchema.safeParse(ack);
      if (!parsed.success) {
        this.logger.error(
          "Invalid dynamic-capabilities-matching ack from Hub",
          {
            error: parsed.error,
            ack,
          },
        );
        return { status: "error", error: "Invalid response from Hub" };
      }
      return parsed.data;
    } catch (e) {
      this.logger.error("dynamic-capabilities-matching request failed", {
        ...loggableError(e),
      });
      return { status: "error", error: "Request failed" };
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      // Connected: stop any pending re-arm and reset its backoff.
      this.clearReArmTimer();
      this.reArmAttempts = 0;
      this.logger.info("Connected to Hub");
      this._status.set({ status: "authenticated" });
      this.bootPhaseHistory = [];
      this.transitionBootPhase("connected");
      if (this.socket) {
        this.usageStatsSender.start(this.socket);
        this.toolCallBatcher.start();
      }
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
      this.handleConnectionDrop();
    });

    this.socket.on("disconnect", (reason, details) => {
      this.logger.info("Disconnected from Hub", { reason, details });
      this.usageStatsSender.stop();
      // Stop the batcher symmetrically; the connect handler restarts it on
      // reconnect. Left running, its flush interval keeps draining the buffer
      // and, once the socket is gone, silently drops tool-call events.
      this.toolCallBatcher.stop();
      this._status.set({
        status: "unauthenticated",
        connectionError: new HubConnectionError(
          `Disconnected from Hub: ${reason}`,
        ),
      });
      this.handleConnectionDrop();
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

    this.socket.on(
      "set-personal-skills",
      (envelope, ack?: (res: { ok: boolean }) => void) => {
        try {
          const parseResult = envelopedSetPersonalSkillsSafeParse(envelope);
          if (!parseResult.success) {
            this.logger.error("Failed to parse set-personal-skills message", {
              error: parseResult.error,
              envelope,
            });
            ack?.({ ok: false });
            return;
          }
          const message = parseResult.data.payload;
          this.logger.info("Received set-personal-skills message from Hub", {
            count: message.skills.length,
          });
          this.personalSkillsListeners.forEach((listener) => listener(message));
          ack?.({ ok: true });
        } catch (e) {
          this.logger.error("Failed to handle set-personal-skills", {
            ...loggableError(e),
            envelope,
          });
          ack?.({ ok: false });
        }
      },
    );

    this.socket.on(
      "set-profile-secrets",
      (envelope, ack?: (res: Ack) => void) => {
        try {
          const parseResult = envelopedSetProfileSecretsSafeParse(envelope);
          if (!parseResult.success) {
            this.logger.error("Failed to parse set-profile-secrets message", {
              error: parseResult.error,
              envelope,
            });
            ack?.({
              ok: false,
              failureMessage: `Failed to parse set-profile-secrets envelope: ${parseResult.error.message}`,
            } satisfies Ack);
            return;
          }
          const message = parseResult.data.payload;
          this.logger.info("Received set-profile-secrets message from Hub", {
            profileSecretCount: Object.keys(message.profileSecrets).length,
            messageTimestamp: message.timestamp,
          });
          const isLiveUpdate = this.bootPhaseHistory.some(
            (e) => e.phase === "profile-secrets-received",
          );
          const applied = this.envVarManager.applyProfileSecrets({
            entries: message.profileSecrets,
            timestamp: message.timestamp,
          });
          if (applied && !isLiveUpdate) {
            this.transitionBootPhase("profile-secrets-received");
          }
          ack?.({ ok: true } satisfies Ack);
        } catch (e) {
          this.logger.error("Failed to handle set-profile-secrets", {
            ...loggableError(e),
            envelope,
          });
          ack?.({
            ok: false,
            failureMessage: makeError(e).message,
          } satisfies Ack);
        }
      },
    );

    this.socket.on(
      "set-oauth-credentials",
      (envelope, ack?: (res: Ack) => void) => {
        try {
          const parseResult = envelopedSetOauthCredentialsSafeParse(envelope);
          if (!parseResult.success) {
            this.logger.error("Failed to parse set-oauth-credentials message", {
              error: parseResult.error,
              envelope,
            });
            ack?.({
              ok: false,
              failureMessage: `Failed to parse set-oauth-credentials envelope: ${parseResult.error.message}`,
            } satisfies Ack);
            return;
          }
          const message = parseResult.data.payload;
          this.logger.info("Received set-oauth-credentials message from Hub", {
            oauthCredentialCount: Object.keys(message.oauthCredentials).length,
            messageTimestamp: message.timestamp,
          });
          const isLiveUpdate = this.bootPhaseHistory.some(
            (e) => e.phase === "oauth-credentials-received",
          );
          const applied = this.envVarManager.applyOauthCredentials({
            entries: message.oauthCredentials,
            timestamp: message.timestamp,
          });
          if (applied && !isLiveUpdate) {
            this.transitionBootPhase("oauth-credentials-received");
          }
          ack?.({ ok: true } satisfies Ack);
        } catch (e) {
          this.logger.error("Failed to handle set-oauth-credentials", {
            ...loggableError(e),
            envelope,
          });
          ack?.({
            ok: false,
            failureMessage: makeError(e).message,
          } satisfies Ack);
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

  // socket.io retries while socket.active; we only step in once it gives up.
  private handleConnectionDrop(): void {
    if (this.socket?.active) return;
    this.scheduleReArm();
  }

  private clearReArmTimer(): void {
    if (this.reArmTimeoutId) {
      clearTimeout(this.reArmTimeoutId);
      this.reArmTimeoutId = null;
    }
  }

  private scheduleReArm(): void {
    if (this.isShuttingDown || this.reArmTimeoutId || !this.lastConnectProps) {
      return;
    }
    // Exponential backoff, capped, with jitter. Clamp after jitter so the
    // delay never exceeds the cap (matches socket.io's own backoff).
    const base = Math.min(
      HUB_RECONNECT_DELAY_MS * 2 ** this.reArmAttempts,
      this.reconnectionDelayMax,
    );
    const jitter =
      base * HUB_RECONNECT_RANDOMIZATION_FACTOR * (Math.random() * 2 - 1);
    const delay = Math.min(
      this.reconnectionDelayMax,
      Math.max(0, Math.round(base + jitter)),
    );
    this.reArmAttempts++;
    this.logger.info("Scheduling Hub re-arm reconnect", {
      delayMs: delay,
      attempt: this.reArmAttempts,
    });
    this.reArmTimeoutId = setTimeout(() => {
      this.reArmTimeoutId = null;
      if (this.isShuttingDown || !this.lastConnectProps) return;
      if (this.status.status === "authenticated") return;
      // Drop the dead socket so connect() builds a fresh one.
      this.socket?.close();
      this.socket = null;
      void this.connect(this.lastConnectProps);
    }, delay);
  }
}
