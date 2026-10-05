import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import { PingOutcome } from "./client-extension.js";

interface UpstreamWatchdogConfig {
  pingIntervalMs: number;
  pingTimeoutMs: number;
  pingFailureThreshold: number;
}

interface WatchedServer {
  consecutiveFailures: number;
  stopPing: () => void;
}

/**
 * Liveness monitor for upstream servers. Periodically pings each watched server
 * and calls onServerUnreachable once pingFailureThreshold consecutive failures
 * accumulate, counting pings and reported tool-call outcomes alike. Reconnect
 * handling is the caller's responsibility.
 */
export class UpstreamWatchdog {
  private readonly watched = new Map<string, WatchedServer>();
  private readonly logger: Logger;

  constructor(
    private readonly target: {
      pingServer(name: string): Promise<PingOutcome>;
      onServerUnreachable(name: string, lastError: Error): Promise<void>;
    },
    private readonly config: UpstreamWatchdogConfig,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "UpstreamWatchdog" });
  }

  watch(name: string): void {
    this.forget(name);
    const pingEnabled = this.config.pingIntervalMs > 0;
    this.watched.set(name, {
      consecutiveFailures: 0,
      stopPing: pingEnabled ? this.startPing(name) : (): void => {},
    });
    if (!pingEnabled) {
      this.logger.debug(
        "Upstream ping disabled, liveness tracked from reported calls only",
        { name },
      );
      return;
    }
    this.logger.debug("Started upstream watchdog", { name });
  }

  unwatch(name: string): void {
    this.forget(name);
    this.logger.debug("Stopped upstream watchdog", { name });
  }

  // Tool-call outcomes count like pings; the only liveness signal for servers without ping support.
  reportSuccess(name: string): void {
    this.report(name, null);
  }

  reportFailure(name: string, error: Error): void {
    this.report(name, error);
  }

  shutdown(): void {
    for (const name of Array.from(this.watched.keys())) {
      this.unwatch(name);
    }
  }

  private forget(name: string): void {
    this.watched.get(name)?.stopPing();
    this.watched.delete(name);
  }

  private report(name: string, error: Error | null): void {
    this.recordOutcome(name, error, "call").catch((e) => {
      this.logger.error("Unexpected error handling reported upstream outcome", {
        name,
        error: loggableError(e),
      });
    });
  }

  // The one place the threshold is applied, for pings and reported calls alike.
  private async recordOutcome(
    name: string,
    error: Error | null,
    source: "ping" | "call",
  ): Promise<void> {
    const server = this.watched.get(name);
    if (!server) return;
    const consecutiveFailures =
      error === null ? 0 : server.consecutiveFailures + 1;
    this.watched.set(name, { ...server, consecutiveFailures });
    if (error === null) return;

    const { pingFailureThreshold } = this.config;
    if (consecutiveFailures < pingFailureThreshold) {
      this.logger.warn("Upstream server failure, tolerated until threshold", {
        name,
        source,
        consecutiveFailures,
        pingFailureThreshold,
        error: loggableError(error),
      });
      return;
    }

    this.logger.error(
      "Upstream server failed repeatedly, triggering reconnect",
      {
        name,
        source,
        consecutiveFailures,
        error: loggableError(error),
      },
    );
    this.unwatch(name);
    await this.target.onServerUnreachable(name, error);
  }

  private startPing(name: string): () => void {
    const { pingIntervalMs } = this.config;

    let stopped = false;
    let timeoutId: NodeJS.Timeout | undefined;

    // Recursive setTimeout: the next ping is only scheduled after the current
    // one completes, so slow pings never overlap.
    const schedule = (): void => {
      timeoutId = setTimeout(() => runPing(), pingIntervalMs);
    };

    const runPing = async (): Promise<void> => {
      try {
        const outcome = await this.target.pingServer(name);
        if (stopped) return;
        // A ping that checked nothing must not reset failures reported by calls.
        if (outcome !== "no-signal") {
          await this.recordOutcome(name, outcome, "ping");
        }
      } catch (e) {
        this.logger.error("Unexpected error in upstream liveness check", {
          name,
          error: loggableError(e),
        });
      }

      if (!stopped) schedule();
    };

    schedule();

    return () => {
      stopped = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }
}
