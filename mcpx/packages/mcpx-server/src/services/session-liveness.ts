import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { EmptyResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Clock } from "@mcpx/toolkit-core/time";
import {
  isInvalidResponseFormatError,
  isMethodNotFoundError,
} from "./client-extension.js";
import {
  CloseSessionReason,
  McpxSession,
  SessionLivenessConfig,
  SessionLivenessStore,
  TouchSource,
} from "../model/sessions.js";

// Fraction of the ping interval a ping may take before it counts as missed.
const PING_TIMEOUT_FACTOR = 0.8;

// Fired when a session's `unresponsive` flag flips.
export type OnLivenessChanged = (sessionId: string) => void;

export class SessionLivenessManager {
  private _store: SessionLivenessStore;
  private _config: SessionLivenessConfig;
  private _logger: Logger;
  private _gcStopper?: () => void;
  private _clock: Clock;
  private _onLivenessChanged: OnLivenessChanged;
  private _probeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    store: SessionLivenessStore,
    config: SessionLivenessConfig,
    logger: Logger,
    clock: Clock,
    onLivenessChanged: OnLivenessChanged,
  ) {
    this._store = store;
    this._config = config;
    this._logger = logger.child({ component: "SessionLiveness" });
    this._clock = clock;
    this._onLivenessChanged = onLivenessChanged;
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
    for (const timer of this._probeTimers.values()) {
      clearTimeout(timer);
    }
    this._probeTimers.clear();
  }

  touchSession(sessionId: string, source?: TouchSource): void {
    const session = this._store.getSession(sessionId);
    if (!session?.liveness) {
      return;
    }
    session.liveness.lastSeenAt = this._clock.now().getTime();
    // Any inbound activity or ping success proves liveness: reset the miss streak
    // and clear staleness so an active client isn't reaped for undeliverable pings.
    session.liveness.consecutiveMisses = 0;
    this.setUnresponsive(sessionId, false);
    this._logger.silly("Session liveness touch", {
      sessionId,
      metadata: session.metadata,
      source,
    });
  }

  // Flag a session unresponsive now (e.g. its notification stream dropped),
  // via the same path as a missed ping. Activity/ping then restores or reaps it.
  markUnresponsive(sessionId: string): void {
    this.setUnresponsive(sessionId, true);
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
    const probeTimer = this._probeTimers.get(sessionId);
    if (probeTimer !== undefined) {
      clearTimeout(probeTimer);
      this._probeTimers.delete(sessionId);
    }
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

    // Stop any prior loop before replacing it so its timer can't leak.
    session.liveness?.stopPing();

    // Only clients with a deliverable ping channel (see isPingCapable) get the
    // ping loop. The rest rely on the idle TTL, reset by inbound activity.
    const stopPing = this.isPingCapable(session)
      ? this.setupPingMonitoring(
          session.server,
          sessionId,
          session.metadata,
          options,
        )
      : (): void => {};
    session.liveness = {
      lastSeenAt: this._clock.now().getTime(),
      unresponsive: false,
      consecutiveMisses: 0,
      stopPing,
    };
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
      return (): void => {};
    }

    const pingTimeoutMs = Math.floor(pingIntervalMs * PING_TIMEOUT_FACTOR);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let running = false;

    const stopPing = (): void => {
      if (stopped) {
        return;
      }
      this._logger.debug("Stopping ping monitoring", { sessionId, metadata });
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    };

    // The SDK owns the per-request timeout. `running` prevents overlap.
    const tick = async (): Promise<void> => {
      if (stopped || running) {
        return;
      }
      running = true;
      try {
        await server.request({ method: "ping" }, EmptyResultSchema, {
          timeout: pingTimeoutMs,
        });
        if (stopped) return;
        this.touchSession(sessionId, TouchSource.Ping);
      } catch (error) {
        if (stopped) return;
        if (isPingUnsupportedError(error)) {
          this.handlePingUnsupported(sessionId, metadata, stopPing);
          return;
        }
        await this.recordMissedPing(sessionId, metadata, error);
      } finally {
        running = false;
      }
      if (!stopped) {
        timer = setTimeout(() => void tick(), pingIntervalMs);
      }
    };

    timer = setTimeout(() => void tick(), pingIntervalMs);

    return stopPing;
  }

  // Notifies only on an actual transition, not on every missed ping.
  private setUnresponsive(sessionId: string, value: boolean): void {
    const session = this._store.getSession(sessionId);
    if (!session?.liveness) {
      return;
    }
    if (session.liveness.unresponsive === value) {
      return;
    }
    session.liveness.unresponsive = value;
    this._logger.debug("Session unresponsive state changed", {
      sessionId,
      unresponsive: value,
      metadata: session.metadata,
    });
    this._onLivenessChanged(sessionId);
  }

  private async recordMissedPing(
    sessionId: string,
    metadata: McpxSession["metadata"],
    error: unknown,
  ): Promise<void> {
    const session = this._store.getSession(sessionId);
    if (!session?.liveness) {
      return;
    }
    session.liveness.consecutiveMisses += 1;
    const consecutiveMisses = session.liveness.consecutiveMisses;
    this._logger.debug("Ping missed (timeout or failure)", {
      sessionId,
      metadata,
      consecutiveMisses,
      error: loggableError(error),
    });
    this.setUnresponsive(sessionId, true);
    const max = this._config.pingMaxConsecutiveTimeouts;
    if (max > 0 && consecutiveMisses >= max) {
      this._logger.debug("Reaping session after consecutive missed pings", {
        sessionId,
        metadata,
        consecutiveMisses,
        max,
      });
      await this._store
        .closeSession(sessionId, CloseSessionReason.PingTimeout)
        .catch((error) => {
          this._logger.warn("Failed to close unresponsive session", {
            sessionId,
            metadata,
            error: loggableError(error),
          });
        });
    }
  }

  private handlePingUnsupported(
    sessionId: string,
    metadata: McpxSession["metadata"],
    stopPing: () => void,
  ): void {
    this._logger.debug(
      "Client does not support ping (method-not-found / invalid-format), stopping ping monitoring",
      { sessionId, metadata },
    );
    this.setUnresponsive(sessionId, false);
    stopPing();
  }

  // Ping is deliverable on SSE (stream always open) or a client that advertises
  // ping support. Others (including `ping === false`) fall back to the idle TTL.
  private isPingCapable(session: McpxSession): boolean {
    const pingSupport = session.metadata.clientInfo.adapter?.support?.ping;
    if (pingSupport === false) {
      return false;
    }
    return session.transport.type === "sse" || pingSupport === true;
  }

  private shouldSkipPingMonitoring(
    metadata: McpxSession["metadata"],
    sessionId: string,
    pingIntervalMs: number,
  ): boolean {
    if (pingIntervalMs <= 0) {
      this._logger.debug("Ping monitoring disabled by interval", {
        sessionId,
        metadata,
        pingIntervalMs,
      });
      return true;
    }
    return false;
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
    const timer = setTimeout(() => {
      this._probeTimers.delete(sessionId);
      void this._store
        .closeSession(sessionId, CloseSessionReason.ProbeTermination)
        .catch(() => {});
    }, options.probeClientsGraceLivenessPeriodMs);
    this._probeTimers.set(sessionId, timer);
  }
}

// Reachable but no working ping (method-not-found or invalid result shape),
// reusing ExtendedClient's classification. Other errors are genuine misses.
function isPingUnsupportedError(error: unknown): boolean {
  return isMethodNotFoundError(error) || isInvalidResponseFormatError(error);
}
