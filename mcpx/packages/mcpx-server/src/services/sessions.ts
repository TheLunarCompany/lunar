import { loggableError } from "@mcpx/toolkit-core/logging";
import { Clock } from "@mcpx/toolkit-core/time";
import { ConnectedClientAdapter } from "@mcpx/shared-model";
import { Logger } from "winston";
import {
  CloseSessionReason,
  McpxSession,
  SessionsManagerConfig,
  TouchSource,
} from "../model/sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { SessionLivenessManager } from "./session-liveness.js";
import {
  DownstreamSessionStore,
  PersistedDownstreamSessionData,
} from "./downstream-session-store.js";

export { CloseSessionReason, TouchSource };

export class SessionsManager {
  private _sessions: Record<string, McpxSession>;
  private systemState: SystemStateTracker;
  private logger: Logger;
  private config: SessionsManagerConfig;
  private liveness: SessionLivenessManager;
  private sessionStore: DownstreamSessionStore;

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
    );
  }

  getSession(sessionId: string): McpxSession | undefined {
    return this._sessions[sessionId];
  }

  touchSession(sessionId: string, source?: TouchSource): void {
    this.liveness.touchSession(sessionId, source);
  }

  async broadcastToolListChanged(): Promise<void> {
    const sessions = this.getAllSessions();
    this.logger.debug("Broadcasting tool list changed to clients", {
      sessionCount: sessions.length,
    });

    await Promise.all(
      sessions.map((session) =>
        session.server.sendToolListChanged().catch((e) => {
          this.logger.debug("Failed to send tool list changed notification", {
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
    this.systemState.recordClientDisconnected({ sessionId });
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

  async shutdown(): Promise<void> {
    this.liveness.shutdown();
    await this.disconnectAllSessions();
  }

  async initialize(): Promise<void> {
    this.liveness.initialize();
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
