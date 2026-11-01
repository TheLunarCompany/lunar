import { loggableError } from "@aigw/core/logging";
import { Logger } from "winston";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { EmptyResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Clock } from "@aigw/core/time";
import {
  isInvalidResponseFormatError,
  isMethodNotFoundError,
} from "./client-extension.js";
import {
  CloseSessionReason,
  McpxSession,
  SessionLiveness,
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
  // Manager-wide so a generation is never reused: a stale close from an earlier
  // stream can never match a newer one.
  private _nextStreamGeneration = 0;

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
    leaveReconnecting(session.liveness);
    this.setUnresponsive(sessionId, false);
    this._logger.silly("Session liveness touch", {
      sessionId,
      metadata: session.metadata,
      source,
    });
  }

  // Total: creates the liveness record if the session has none, so callers
  // never depend on "onSessionAdded ran first".
  private getOrInitLiveness(sessionId: string): SessionLiveness | undefined {
    const session = this._store.getSession(sessionId);
    if (!session) {
      return undefined;
    }
    session.liveness ??= this.createLiveness(session, (): void => {});
    return session.liveness;
  }

  private createLiveness(
    session: McpxSession,
    stopPing: () => void,
  ): SessionLiveness {
    return {
      lastSeenAt: this._clock.now().getTime(),
      unresponsive: false,
      consecutiveMisses: 0,
      pingSupport: "unknown",
      stopPing,
      // SSE's stream is permanently open; generation 0 is reserved for it.
      notificationStream:
        session.transport.type === "sse"
          ? { _type: "open", generation: 0 }
          : { _type: "none" },
    };
  }

  // A GET arrived. It supersedes whatever stream state existed (including
  // "open" — the new GET isn't accepted yet, so pings must not be delivered
  // until markNotificationStreamOpen).
  beginNotificationStream(sessionId: string): number {
    const liveness = this.getOrInitLiveness(sessionId);
    if (!liveness) {
      return 0;
    }
    leaveReconnecting(liveness);
    const generation = ++this._nextStreamGeneration;
    liveness.notificationStream = { _type: "opening", generation };
    return generation;
  }

  // No-ops unless this generation is the one currently "opening".
  markNotificationStreamOpen(props: {
    sessionId: string;
    generation: number;
  }): void {
    const { sessionId, generation } = props;
    const liveness = this.getOrInitLiveness(sessionId);
    const stream = liveness?.notificationStream;
    if (
      !liveness ||
      stream?._type !== "opening" ||
      stream.generation !== generation
    ) {
      return;
    }
    liveness.notificationStream = { _type: "open", generation };
  }

  // No-ops for stale or already-closed generations (so a duplicate close does
  // not restart the grace timer). Never closes the session: after the grace
  // period it only flags it unresponsive.
  markNotificationStreamClosed(props: {
    sessionId: string;
    generation: number;
  }): void {
    const { sessionId, generation } = props;
    const liveness = this.getOrInitLiveness(sessionId);
    const stream = liveness?.notificationStream;
    if (
      !liveness ||
      (stream?._type !== "opening" && stream?._type !== "open") ||
      stream.generation !== generation
    ) {
      return;
    }
    const graceMs = this._config.notificationStreamReconnectGraceMs;
    if (graceMs <= 0) {
      liveness.notificationStream = { _type: "none" };
      this.setUnresponsive(sessionId, true);
      return;
    }
    liveness.notificationStream = {
      _type: "reconnecting",
      generation,
      cancelGrace: this.startReconnectGrace({ sessionId, generation, graceMs }),
    };
  }

  // A real ping answer: proves the client handles ping (so later misses are
  // meaningful) and is proof of life like any inbound activity.
  recordPingAnswered(sessionId: string): void {
    const liveness = this.getOrInitLiveness(sessionId);
    if (!liveness) {
      return;
    }
    liveness.pingSupport = "answered";
    this.touchSession(sessionId, TouchSource.Ping);
  }

  markPingUnsupported(sessionId: string): void {
    const liveness = this.getOrInitLiveness(sessionId);
    if (!liveness) {
      return;
    }
    liveness.pingSupport = "unsupported";
    this.setUnresponsive(sessionId, false);
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

  // Starts the reconnect-grace timer for a stream that just dropped and
  // returns its cancel function. The caller stores that function inside the
  // "reconnecting" state, which is what makes cancellation reliable: every
  // way out of "reconnecting" (a new GET → beginNotificationStream, inbound
  // activity → touchSession, session removal → stopSessionLiveness) goes
  // through leaveReconnecting(), which calls cancelGrace(). If none of them
  // happens, the timer fires and flags the session unresponsive — it never
  // closes it: a dropped GET doesn't prove the client is gone, and a wrong
  // close costs the user a reconnect, a wrong badge costs almost nothing.
  private startReconnectGrace(props: {
    sessionId: string;
    generation: number;
    graceMs: number;
  }): () => void {
    const { sessionId, generation, graceMs } = props;
    const timeout = setTimeout(() => {
      const liveness = this._store.getSession(sessionId)?.liveness;
      const stream = liveness?.notificationStream;
      if (
        !liveness ||
        stream?._type !== "reconnecting" ||
        stream.generation !== generation
      ) {
        return;
      }
      liveness.notificationStream = { _type: "none" };
      this.setUnresponsive(sessionId, true);
    }, graceMs);
    return (): void => clearTimeout(timeout);
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
    leaveReconnecting(session.liveness);
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
    if (session.liveness) {
      session.liveness.stopPing();
      leaveReconnecting(session.liveness);
    }

    // Every transport gets the ping loop; the tick itself skips while there is
    // no open notification stream to deliver on (see canDeliverPing).
    const stopPing = this.setupPingMonitoring(
      session.server,
      sessionId,
      session.metadata,
      options,
    );
    session.liveness = this.createLiveness(session, stopPing);
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
      if (
        this._store.getSession(sessionId)?.liveness?.pingSupport ===
        "unsupported"
      ) {
        stopPing(); // learned elsewhere (e.g. a downstream keepalive)
        return;
      }
      if (!this.canDeliverPing(sessionId)) {
        timer = setTimeout(() => void tick(), pingIntervalMs);
        return;
      }
      running = true;
      try {
        await server.request({ method: "ping" }, EmptyResultSchema, {
          timeout: pingTimeoutMs,
        });
        if (stopped) return;
        this.recordPingAnswered(sessionId);
      } catch (error) {
        if (stopped) return;
        if (isPingUnsupportedError(error)) {
          this._logger.debug(
            "Client does not support ping (method-not-found / invalid-format), stopping ping monitoring",
            { sessionId, metadata },
          );
          this.markPingUnsupported(sessionId);
          stopPing();
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
    if (max <= 0 || consecutiveMisses < max) {
      return;
    }
    if (!canReapOnMissedPings(session)) {
      this._logger.debug("Not reaping: client never answered a ping", {
        sessionId,
        metadata,
        consecutiveMisses,
      });
      return;
    }
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

  // A server-initiated ping only reaches the client over the standalone
  // notification stream; without one, the SDK would silently drop it.
  private canDeliverPing(sessionId: string): boolean {
    const liveness = this._store.getSession(sessionId)?.liveness;
    return liveness?.notificationStream._type === "open";
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

// Every way out of "reconnecting" must cancel its timer, or it would later
// fire against a stream that has since moved on.
function leaveReconnecting(liveness: SessionLiveness): void {
  if (liveness.notificationStream._type !== "reconnecting") {
    return;
  }
  liveness.notificationStream.cancelGrace();
  liveness.notificationStream = { _type: "none" };
}

// SSE's stream is permanently open, so its misses are real signals. A
// streamableHttp client that never answered a ping may simply not handle it
// (hang instead of rejecting), so only one that answered before is reaped
// when it goes silent. Everything else relies on DELETE and the idle TTL.
function canReapOnMissedPings(session: McpxSession): boolean {
  return (
    session.transport.type === "sse" ||
    session.liveness?.pingSupport === "answered"
  );
}

// Reachable but no working ping (method-not-found or invalid result shape),
// reusing ExtendedClient's classification. Other errors are genuine misses.
export function isPingUnsupportedError(error: unknown): boolean {
  return isMethodNotFoundError(error) || isInvalidResponseFormatError(error);
}
