import { loggableError } from "@mcpx/toolkit-core/logging";
import { Clock } from "@mcpx/toolkit-core/time";
import { ConnectedClientAdapter } from "@mcpx/shared-model";
import { Logger } from "winston";
import {
  CloseSessionReason,
  McpxSession,
  SessionLivenessInfo,
  SessionsManagerConfig,
  TouchSource,
} from "../model/sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { SessionLivenessManager } from "./session-liveness.js";
import {
  DownstreamSessionStore,
  PersistedDownstreamSessionData,
} from "./downstream-session-store.js";
import {
  CapabilityKind,
  enabledCapabilityKinds,
} from "./capability-registry.js";
import { ConsumerContext } from "./capability-resolver.js";

export { CloseSessionReason, TouchSource };

const CAPABILITY_LIST_CHANGED_DEBOUNCE_MS = 200;

interface CapabilityBroadcastDef {
  send: (
    session: McpxSession,
  ) => ReturnType<McpxSession["server"]["sendToolListChanged"]>;
}

// Keys match the resolver's CapabilityKind so callers can pass through.
const CAPABILITY_BROADCASTS: Record<CapabilityKind, CapabilityBroadcastDef> = {
  tools: { send: (s) => s.server.sendToolListChanged() },
  prompts: { send: (s) => s.server.sendPromptListChanged() },
  resources: { send: (s) => s.server.sendResourceListChanged() },
};

export class SessionsManager {
  private _sessions: Record<string, McpxSession>;
  private systemState: SystemStateTracker;
  private logger: Logger;
  private config: SessionsManagerConfig;
  private liveness: SessionLivenessManager;
  private sessionStore: DownstreamSessionStore;
  private clock: Clock;
  private recoveryLoaded = false;
  private _listChangedDebounces: Partial<
    Record<CapabilityKind, ReturnType<typeof setTimeout>>
  > = {};

  constructor(
    config: SessionsManagerConfig,
    metricRecorder: SystemStateTracker,
    logger: Logger,
    clock: Clock,
    sessionStore: DownstreamSessionStore,
  ) {
    this._sessions = {};
    this.systemState = metricRecorder;
    this.logger = logger.child({ component: "SessionsManager" });
    this.config = config;
    this.sessionStore = sessionStore;
    this.clock = clock;
    this.liveness = new SessionLivenessManager(
      {
        getSession: (sessionId): McpxSession | undefined =>
          this._sessions[sessionId],
        listSessions: (): Iterable<[string, McpxSession]> =>
          Object.entries(this._sessions),
        closeSession: async (sessionId, reason): Promise<void> =>
          this.closeSession(sessionId, reason),
      },
      this.config,
      this.logger,
      clock,
      (sessionId) => this.onLivenessChanged(sessionId),
    );
  }

  // A live session is only ever connected or unresponsive. "disconnected" is
  // reserved for recovered offline records.
  private onLivenessChanged(sessionId: string): void {
    const session = this._sessions[sessionId];
    if (!session) {
      return;
    }
    this.systemState.setClientConnectionState(
      sessionId,
      session.liveness?.unresponsive ? "unresponsive" : "connected",
    );
  }

  getSession(sessionId: string): McpxSession | undefined {
    return this._sessions[sessionId];
  }

  getConsumerContext(sessionId: string | undefined): ConsumerContext {
    if (!sessionId) return {};
    const session = this._sessions[sessionId];
    if (!session) return {};
    return {
      consumerTag: session.metadata.consumerTag,
      clientName: session.metadata.clientInfo?.name,
      sessionId,
    };
  }

  touchSession(sessionId: string, source?: TouchSource): void {
    this.liveness.touchSession(sessionId, source);
  }

  // Read-only liveness snapshot, consumed by the report merge (T07).
  getSessionLiveness(sessionId: string): SessionLivenessInfo | undefined {
    const liveness = this._sessions[sessionId]?.liveness;
    if (!liveness) {
      return undefined;
    }
    return {
      lastSeenAt: liveness.lastSeenAt,
      unresponsive: liveness.unresponsive,
    };
  }

  // Flag a session unresponsive now (e.g. its notification stream dropped),
  // via the same liveness path as a missed ping.
  markSessionUnresponsive(sessionId: string): void {
    this.liveness.markUnresponsive(sessionId);
  }

  // Best-effort: a streamable client receives this only while its GET stream is
  // open (replay buffer backstops brief drops), and must re-list to apply it.
  async broadcastListChanged(kind: CapabilityKind): Promise<void> {
    const sessions = this.getAllSessions();
    const { send } = CAPABILITY_BROADCASTS[kind];
    this.logger.debug("Broadcasting capability list changed to clients", {
      kind,
      sessionCount: sessions.length,
    });

    await Promise.all(
      sessions.map((session) =>
        send(session).catch((e) => {
          this.logger.debug("Failed to send list changed notification", {
            kind,
            error: loggableError(e),
          });
        }),
      ),
    );
  }

  async loadPersistedDownstreamSession(
    sessionId: string,
  ): Promise<PersistedDownstreamSessionData | undefined> {
    return this.sessionStore.load(sessionId).catch((e) => {
      this.logger.warn("Failed to load persisted downstream session", {
        sessionId,
        error: loggableError(e),
      });
      return undefined;
    });
  }

  async addSession(sessionId: string, session: McpxSession): Promise<void> {
    this._sessions[sessionId] = session;
    this.liveness.onSessionAdded(sessionId);
    if (session.metadata.isProbe) {
      return;
    }
    void this.sessionStore
      .store(sessionId, { metadata: session.metadata })
      .catch((e) => {
        this.logger.warn("Failed to persist downstream session", {
          sessionId,
          error: loggableError(e),
        });
      });
    this.systemState.recordClientConnected({
      sessionId,
      client: {
        clientId: session.metadata.clientId,
        consumerTag: session.metadata.consumerTag,
        llm: {
          provider: session.metadata.llm?.provider,
          modelId: session.metadata.llm?.modelId,
        },
        clientInfo: {
          ...session.metadata.clientInfo,
          adapter: this.prepareClientAdapter(
            session.metadata.clientInfo.adapter,
          ),
        },
      },
    });
  }

  updateSessionMetadata(
    sessionId: string,
    metadata: McpxSession["metadata"],
  ): void {
    const session = this._sessions[sessionId];
    if (!session) {
      return;
    }

    session.metadata = metadata;

    if (metadata.clientInfo.adapter?.support?.ping === false) {
      session.liveness?.stopPing();
    }

    if (!metadata.isProbe) {
      void this.sessionStore.store(sessionId, { metadata }).catch((e) => {
        this.logger.warn("Failed to update persisted downstream session", {
          sessionId,
          error: loggableError(e),
        });
      });
    }
  }

  async closeSession(
    sessionId: string,
    reason: CloseSessionReason,
  ): Promise<void> {
    const session = this._sessions[sessionId];
    if (!session) {
      return;
    }

    this.logger.debug("Closing session", { sessionId, reason });
    this.liveness.onSessionRemoved(sessionId);
    delete this._sessions[sessionId];
    // Keep a client-gone disconnect visible as offline for the retention window.
    // Hard-remove only on shutdown or probe teardown.
    if (
      reason === CloseSessionReason.Shutdown ||
      reason === CloseSessionReason.ProbeTermination
    ) {
      this.systemState.recordClientDisconnected({ sessionId });
    } else {
      this.systemState.markClientDisconnected(
        sessionId,
        this.clock.now().getTime(),
      );
    }
    if (reason !== CloseSessionReason.Shutdown) {
      void this.sessionStore.delete(sessionId).catch((e) => {
        this.logger.warn("Failed to delete persisted downstream session", {
          sessionId,
          error: loggableError(e),
        });
      });
    }

    await session.server.close().catch((error) => {
      this.logger.debug("Failed to close server", {
        sessionId,
        error: loggableError(error),
      });
    });

    await session.transport.transport.close().catch((error) => {
      this.logger.debug("Failed to close transport", {
        sessionId,
        error: loggableError(error),
      });
    });
  }

  scheduleBroadcastListChanged(kind: CapabilityKind): void {
    clearTimeout(this._listChangedDebounces[kind]);
    this._listChangedDebounces[kind] = setTimeout(() => {
      this.broadcastListChanged(kind).catch((e) => {
        this.logger.warn("Failed to broadcast capability list changed", {
          kind,
          error: loggableError(e),
        });
      });
    }, CAPABILITY_LIST_CHANGED_DEBOUNCE_MS);
  }

  // Re-broadcast every exposed kind. For config changes that can shift
  // per-consumer visibility without moving the resolver's active set (e.g.
  // permissions, which gate tools and prompts alike).
  scheduleBroadcastAllListChanged(): void {
    for (const kind of enabledCapabilityKinds()) {
      this.scheduleBroadcastListChanged(kind);
    }
  }

  async shutdown(): Promise<void> {
    for (const handle of Object.values(this._listChangedDebounces)) {
      clearTimeout(handle);
    }
    this._listChangedDebounces = {};
    this.liveness.shutdown();
    await this.disconnectAllSessions();
  }

  async initialize(): Promise<void> {
    this.liveness.initialize();
    // Recovery load is deferred to Hub authentication (store needs a live socket).
  }

  // After a restart, surface persisted sessions as offline. Latches on the first
  // successful list, so a transient failure retries on the next Hub connect. A
  // same-id reconnect (addSession) later overwrites a record as connected.
  async loadDisconnectedSessions(): Promise<void> {
    if (this.recoveryLoaded) {
      return;
    }
    let entries;
    try {
      entries = await this.sessionStore.list();
    } catch (e) {
      this.logger.warn(
        "Failed to list persisted downstream sessions; will retry on next Hub connect",
        { error: loggableError(e) },
      );
      return;
    }
    this.recoveryLoaded = true;
    if (entries.length === 0) {
      return;
    }
    const disconnectedAt = this.clock.now().getTime();
    let recorded = 0;
    for (const { sessionId, data } of entries) {
      // A live session (already reconnected) wins. Probes are never shown.
      if (this._sessions[sessionId] || data.metadata.isProbe) {
        continue;
      }
      this.systemState.recordDisconnectedClient({
        sessionId,
        client: {
          clientId: data.metadata.clientId,
          consumerTag: data.metadata.consumerTag,
          llm: {
            provider: data.metadata.llm?.provider,
            modelId: data.metadata.llm?.modelId,
          },
          clientInfo: {
            ...data.metadata.clientInfo,
            adapter: this.prepareClientAdapter(
              data.metadata.clientInfo.adapter,
            ),
          },
        },
        disconnectedAt,
      });
      recorded += 1;
    }
    this.logger.info("Surfaced persisted downstream sessions as disconnected", {
      total: entries.length,
      recorded,
    });
  }

  private getAllSessions(): McpxSession[] {
    return Object.values(this._sessions);
  }

  private prepareClientAdapter(
    adapter: McpxSession["metadata"]["clientInfo"]["adapter"],
  ): ConnectedClientAdapter | undefined {
    if (!adapter) {
      return undefined;
    }
    const support = adapter.support;
    const semver = adapter.version;
    if (!semver) {
      return { name: adapter.name, support };
    }
    return {
      name: adapter.name,
      support,
      version: {
        major: semver.major,
        minor: semver.minor,
        patch: semver.patch,
        prerelease: [...semver.prerelease],
        build: [...semver.build],
      },
    };
  }

  private async disconnectAllSessions(): Promise<void> {
    const promises = Object.keys(this._sessions).map((sessionId) =>
      this.closeSession(sessionId, CloseSessionReason.Shutdown),
    );
    await Promise.allSettled(promises);
  }
}
