import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

interface UpstreamWatchdogConfig {
  pingIntervalMs: number;
  pingTimeoutMs: number;
}

/**
 * Liveness monitor for upstream servers. Periodically pings each watched server
 * and calls onServerUnreachable when a ping fails. Reconnect handling is the
 * caller's responsibility.
 */
export class UpstreamWatchdog {
  private readonly stoppers = new Map<string, () => void>();
  private readonly logger: Logger;

  constructor(
    private readonly target: {
      pingServer(name: string): Promise<Error | null>;
      onServerUnreachable(name: string, lastError: Error): Promise<void>;
    },
    private readonly config: UpstreamWatchdogConfig,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "UpstreamWatchdog" });
  }

  watch(name: string): void {
    this.stopPing(name);
    if (this.config.pingIntervalMs <= 0) {
      this.logger.debug("Upstream liveness monitoring disabled", { name });
      return;
    }
    this.stoppers.set(name, this.startPing(name));
    this.logger.debug("Started upstream watchdog", { name });
  }

  unwatch(name: string): void {
    this.stopPing(name);
    this.logger.debug("Stopped upstream watchdog", { name });
  }

  shutdown(): void {
    for (const name of Array.from(this.stoppers.keys())) {
      this.stopPing(name);
    }
  }

  private stopPing(name: string): void {
    this.stoppers.get(name)?.();
    this.stoppers.delete(name);
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
        const error = await this.target.pingServer(name);
        if (error !== null) {
          this.logger.error(
            "Upstream server ping failed, triggering reconnect",
            {
              name,
              error: loggableError(error),
            },
          );
          this.stopPing(name);
          stopped = true;
          await this.target.onServerUnreachable(name, error);
          return;
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
