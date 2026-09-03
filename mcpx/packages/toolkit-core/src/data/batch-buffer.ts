import { Logger } from "winston";
import { loggableError } from "../logging/errors.js";
import { makeError } from "./errors.js";
import {
  Clock,
  IntervalClock,
  systemClock,
  systemIntervalClock,
} from "../time/clock.js";

const DEFAULT_FAILURE_REPORT_INTERVAL_MS = 180_000; // 3 minutes

export interface BatchBufferConfig {
  flushIntervalMs: number;
  maxBufferSize: number;
  // Minimum time between "still failing" reports while flushes keep failing.
  failureReportIntervalMs?: number;
}

export interface BatchBufferOptions<T> extends BatchBufferConfig {
  name: string;
  onFlush: (items: T[]) => void | Promise<void>;
  logger: Logger;
  clock?: IntervalClock;
  wallClock?: Clock;
}

interface FlushFailureState {
  failingSince: Date;
  lastReportAt: Date;
  droppedSinceLastReport: number;
  totalDropped: number;
}

export class BatchBuffer<T> {
  private buffer: T[] = [];
  private flushIntervalId: NodeJS.Timeout | null = null;
  private failureState: FlushFailureState | null = null;
  private readonly clock: IntervalClock;
  private readonly wallClock: Clock;
  private readonly failureReportIntervalMs: number;

  constructor(private readonly options: BatchBufferOptions<T>) {
    this.clock = options.clock ?? systemIntervalClock;
    this.wallClock = options.wallClock ?? systemClock;
    this.failureReportIntervalMs =
      options.failureReportIntervalMs ?? DEFAULT_FAILURE_REPORT_INTERVAL_MS;
  }

  start(): void {
    this.stop();
    this.flushIntervalId = this.clock.setInterval(() => {
      void this.flush();
    }, this.options.flushIntervalMs);
  }

  stop(): void {
    if (this.flushIntervalId) {
      this.clock.clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  async shutdown(): Promise<void> {
    this.stop();
    await this.flush();
  }

  add(items: T[]): void {
    this.buffer.push(...items);

    if (this.buffer.length >= this.options.maxBufferSize) {
      void this.flush();
    }
  }

  // Never rejects: flush failures are absorbed into the failure-reporting
  // state so callers can fire-and-forget. Failed batches are dropped.
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const toFlush = this.buffer;
    this.buffer = [];

    this.options.logger.debug(
      `Flushing ${this.options.name} buffer (${toFlush.length} items)`,
    );

    try {
      await this.options.onFlush(toFlush);
      this.resolveFlushFailure();
    } catch (e) {
      this.trackFlushFailure(makeError(e), toFlush.length);
    }
  }

  private resolveFlushFailure(): void {
    if (!this.failureState) return;

    const now = this.wallClock.now();
    const { failingSince, totalDropped } = this.failureState;
    this.options.logger.info(`Flushing ${this.options.name} buffer recovered`, {
      failingSince: failingSince.toISOString(),
      failureDurationMs: now.getTime() - failingSince.getTime(),
      droppedSinceFailureStart: totalDropped,
    });
    this.failureState = null;
  }

  private trackFlushFailure(e: Error, droppedCount: number): void {
    const now = this.wallClock.now();
    const error = loggableError(e);

    // First failure - shout once, then go quiet(er)
    if (!this.failureState) {
      this.failureState = {
        failingSince: now,
        lastReportAt: now,
        droppedSinceLastReport: 0,
        totalDropped: droppedCount,
      };
      this.options.logger.error(
        `Failed to flush ${this.options.name} buffer - dropping items. Further failures will be reported at most every ${this.failureReportIntervalMs}ms`,
        { error, droppedItems: droppedCount },
      );
      return;
    }

    // Already failing - keep counting what we drop
    const accumulated: FlushFailureState = {
      ...this.failureState,
      droppedSinceLastReport:
        this.failureState.droppedSinceLastReport + droppedCount,
      totalDropped: this.failureState.totalDropped + droppedCount,
    };

    // Too soon for another loud report - stay at debug
    const reportIsDue =
      now.getTime() - accumulated.lastReportAt.getTime() >=
      this.failureReportIntervalMs;
    if (!reportIsDue) {
      this.failureState = accumulated;
      this.options.logger.debug(
        `Still failing to flush ${this.options.name} buffer`,
        { error, droppedItems: droppedCount },
      );
      return;
    }

    // Report time - one loud line with running totals, then reset the window
    this.options.logger.error(
      `Ongoing failure flushing ${this.options.name} buffer - accumulating drops since failure started`,
      {
        error,
        failingSince: accumulated.failingSince.toISOString(),
        droppedSinceLastReport: accumulated.droppedSinceLastReport,
        droppedSinceFailureStart: accumulated.totalDropped,
      },
    );
    this.failureState = {
      ...accumulated,
      lastReportAt: now,
      droppedSinceLastReport: 0,
    };
  }
}
