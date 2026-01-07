import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Clock } from "@mcpx/toolkit-core/time";
import {
  CloseSessionReason,
  McpxSession,
  SessionLivenessConfig,
  SessionLivenessStore,
  TouchSource,
} from "../model/sessions.js";

type PingResult =
  | { type: "timeout" }
  | { type: "failure"; error: Error }
  | { type: "success" };

const PING_TIMEOUT_FACTOR = 0.8;

export class SessionLivenessManager {
  private _store: SessionLivenessStore;
  private _config: SessionLivenessConfig;
  private _logger: Logger;
  private _gcStopper?: () => void;
  private _clock: Clock;

  constructor(
    store: SessionLivenessStore,
    config: SessionLivenessConfig,
    logger: Logger,
    clock: Clock,
  ) {
    this._store = store;
    this._config = config;
    this._logger = logger.child({ component: "SessionLiveness" });
    this._clock = clock;
  }

  initialize(): void {
    this.startSessionGc({
      ttlMin: this._config.sessionTtlMin,
      sweepIntervalMin: this._config.sessionSweepIntervalMin,
    });
  }

  shutdown(): void {
    this.stopGc();
    this.stopAllSessionLiveness();
  }

  touchSession(sessionId: string, source?: TouchSource): void {
    const session = this._store.getSession(sessionId);
    if (!session?.liveness) {
      return;
    }
    session.liveness.lastSeenAt = this._clock.now().getTime();
    this._logger.silly("Session liveness touch", {
      sessionId,
      metadata: session.metadata,
      source,
    });
  }

  onSessionAdded(sessionId: string): void {
    const session = this._store.getSession(sessionId);
    if (!session) {
      return;
    }

    if (session.metadata.isProbe) {
      this.scheduleProbeTransportTermination(sessionId, {
        probeClientsGraceLivenessPeriodMs:
          this._config.probeClientsGraceLivenessPeriodMs,
      });
    }

    this.startLivenessMonitoring(sessionId, {
      pingIntervalMs: this._config.pingIntervalMs,
    });
  }

  onSessionRemoved(sessionId: string): void {
    this.stopSessionLiveness(sessionId);
  }

  private startSessionGc(options: {
    ttlMin: number;
    sweepIntervalMin?: number;
  }): void {
    if (this._gcStopper) {
      return;
    }
    const { ttlMin, sweepIntervalMin } = options;
    if (ttlMin <= 0) {
      this._logger.debug("Session GC disabled", { ttlMin, sweepIntervalMin });
      return;
    }
    const ttlMs = ttlMin * 60_000;
    const sweepIntervalMs = (sweepIntervalMin ?? ttlMin) * 60_000;
    if (sweepIntervalMs <= 0) {
      this._logger.debug("Session GC disabled by sweep interval", {
        ttlMin,
        sweepIntervalMin,
      });
      return;
    }
    const interval = setInterval(async (): Promise<void> => {
      const now = this._clock.now().getTime();
      for (const [sessionId, session] of this._store.listSessions()) {
        const liveness = session?.liveness;
        if (!liveness) {
          continue;
        }
        const idleMs = now - liveness.lastSeenAt;
        if (idleMs <= ttlMs) {
          continue;
        }
        this._logger.debug("Session idle TTL exceeded, closing session", {
          sessionId,
          metadata: session.metadata,
          idleMs,
          ttlMs,
        });

        await this._store
          .closeSession(sessionId, CloseSessionReason.IdleTtlExceeded)
          .catch((error) => {
            this._logger.warn("Failed to close expired session", {
              sessionId,
              metadata: session.metadata,
              error: loggableError(error),
            });
          });
      }
    }, sweepIntervalMs);

    this._gcStopper = (): void => {
      clearInterval(interval);
      this._gcStopper = undefined;
    };
  }

  private stopGc(): void {
    this._gcStopper?.();
  }

  private stopSessionLiveness(sessionId: string): void {
    const session = this._store.getSession(sessionId);
    if (!session?.liveness) {
      return;
    }
    session.liveness.stopPing();
    delete session.liveness;
  }

  private stopAllSessionLiveness(): void {
    for (const [sessionId] of this._store.listSessions()) {
      this.stopSessionLiveness(sessionId);
    }
  }

  private startLivenessMonitoring(
    sessionId: string,
    options: {
      pingIntervalMs: number;
    },
  ): void {
    const session = this._store.getSession(sessionId);
    if (!session) {
      return;
    }

    if (this._config.sessionTtlMin <= 0) {
      return;
    }

    const entry: McpxSession["liveness"] = {
      lastSeenAt: this._clock.now().getTime(),
      stopPing: this.setupPingMonitoring(
        session.server,
        sessionId,
        session.metadata,
        options,
      ),
    };
    session.liveness = entry;
    return;
  }

  private setupPingMonitoring(
    server: Server,
    sessionId: string,
    metadata: McpxSession["metadata"],
    options: {
      pingIntervalMs: number;
    },
  ): () => void {
    const { pingIntervalMs } = options;
    if (this.shouldSkipPingMonitoring(metadata, sessionId, pingIntervalMs)) {
      return () => {};
    }

    let pingInProgress = false;
    const pingTimeoutMs = Math.floor(pingIntervalMs * PING_TIMEOUT_FACTOR);
    const interval = setInterval(async (): Promise<void> => {
      if (pingInProgress) {
        this._logger.silly("Skipping ping, previous ping still in progress");
        return;
      }
      pingInProgress = true;
      const result = await this.executePingWithTimeout(
        server,
        pingTimeoutMs,
        sessionId,
        metadata,
      );
      switch (result.type) {
        case "timeout":
          // ignore (keep for case we want to add a flow for ping timeout)
          break;
        case "failure":
          this._logger.debug("Ping failed", {
            sessionId,
            metadata,
            error: loggableError(result.error),
          });
          break;
        case "success":
          this._logger.silly("Ping successful", { sessionId, metadata });
          this.touchSession(sessionId, TouchSource.Ping);
          break;
      }

      pingInProgress = false;
      this._logger.silly("Ping check complete", {
        metadata,
        result,
      });
    }, pingIntervalMs);

    let stopped = false;
    return () => {
      if (stopped) {
        return;
      }
      this._logger.debug("Stopping ping monitoring", { sessionId, metadata });
      clearInterval(interval);
      stopped = true;
    };
  }

  private shouldSkipPingMonitoring(
    metadata: McpxSession["metadata"],
    sessionId: string,
    pingIntervalMs: number,
  ): boolean {
    if (metadata.clientInfo.adapter?.support?.ping === false) {
      this._logger.info(
        "Client adapter does not support ping, skipping ping monitoring",
        { sessionId, metadata },
      );
      return true;
    }
    if (pingIntervalMs <= 0) {
      this._logger.info("Ping monitoring disabled by interval", {
        sessionId,
        metadata,
        pingIntervalMs,
      });
      return true;
    }
    return false;
  }

  private async executePingWithTimeout(
    server: Server,
    pingTimeoutMs: number,
    sessionId: string,
    metadata: McpxSession["metadata"],
  ): Promise<PingResult> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<PingResult>((resolve) => {
      timeoutId = setTimeout(
        () => resolve({ type: "timeout" as const }),
        pingTimeoutMs,
      );
    });

    const pingPromise = server
      .ping()
      .then(() => ({ type: "success" as const }))
      .catch((error) => ({ type: "failure" as const, error }))
      .finally(() => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      });

    return Promise.race([pingPromise, timeoutPromise]).catch((error) => {
      this._logger.error("Unexpected error during ping", {
        error: loggableError(error),
        sessionId,
        metadata,
      });
      return { type: "failure" as const, error };
    });
  }

  private scheduleProbeTransportTermination(
    sessionId: string,
    options: {
      probeClientsGraceLivenessPeriodMs: number;
    },
  ): void {
    const session = this._store.getSession(sessionId);
    if (!session) {
      return;
    }
    setTimeout(async () => {
      await this._store
        .closeSession(sessionId, CloseSessionReason.ProbeTermination)
        .catch(() => {
          // ignore
        });
    }, options.probeClientsGraceLivenessPeriodMs);
  }
}
