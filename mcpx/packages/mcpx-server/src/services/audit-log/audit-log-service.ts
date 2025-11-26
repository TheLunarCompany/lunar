import { Clock } from "@mcpx/toolkit-core/time";
import { env } from "../../env.js";
import { AuditLog, AuditLogEvent } from "../../model/audit-log-type.js";
import { AuditLogPersistence } from "./audit-log-persistence.js";
import { LunarLogger } from "@mcpx/toolkit-core/logging";

export class AuditLogService {
  private buffer: AuditLog[] = [];
  private flushIntervalMs: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly logger: LunarLogger,
    private readonly persistence: AuditLogPersistence,
    flushIntervalMs?: number,
  ) {
    this.flushIntervalMs =
      flushIntervalMs ?? env.AUDIT_LOG_FLUSH_INTERVAL_IN_SEC * 1000;
    this.startFlushTimer();
  }

  private async flush(): Promise<void> {
    // Check if buffer has events to flush
    if (this.buffer.length === 0) {
      this.logger.silly("No events in buffer to flush");
      return;
    }

    // Get all events from buffer while preserving order
    const eventsToFlush = [...this.buffer];

    // Clear the buffer
    this.buffer = [];

    try {
      await this.persistence.persist(eventsToFlush);
    } catch (error) {
      this.logger.error("Error during audit log persistence", { error });
      Promise.reject(error);
    }
  }

  public log(event: AuditLogEvent): void {
    // Create new audit log event
    const log: AuditLog = {
      timestamp: this.clock.now(),
      createdAt: undefined,
      ...event,
    };
    if (env.ENABLE_AUDIT_LOG) {
      this.buffer.push(log);
    }
  }

  private startFlushTimer(): void {
    // Clear any existing timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Start new timer that calls flush every flushIntervalMs
    this.flushTimer = setInterval(async () => {
      try {
        this.logger.silly("Timer triggered - flushing audit log buffer");
        await this.flush();
      } catch (error) {
        this.logger.warn("Error during periodic audit log flush", { error });
      }
    }, this.flushIntervalMs);

    // Call .unref() to prevent the timer from keeping the process alive
    this.flushTimer.unref();

    this.logger.silly(
      `Started audit log flush timer with ${this.flushIntervalMs}ms interval`,
    );
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down AuditLogService...");

    // Clear the timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush on shutdown
    await this.flush();
    this.logger.info("AuditLogService shutdown complete");
  }
}
