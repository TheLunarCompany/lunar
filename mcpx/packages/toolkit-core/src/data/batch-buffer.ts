import { Logger } from "winston";
import { loggableError } from "../logging/errors.js";
import { IntervalClock, systemIntervalClock } from "../time/clock.js";

export interface BatchBufferConfig {
  flushIntervalMs: number;
  maxBufferSize: number;
}

export interface BatchBufferOptions<T> extends BatchBufferConfig {
  name: string;
  onFlush: (items: T[]) => void | Promise<void>;
  logger: Logger;
  clock?: IntervalClock;
}

export class BatchBuffer<T> {
  private buffer: T[] = [];
  private flushIntervalId: NodeJS.Timeout | null = null;
  private readonly clock: IntervalClock;

  constructor(private readonly options: BatchBufferOptions<T>) {
    this.clock = options.clock ?? systemIntervalClock;
  }

  start(): void {
    this.stop();
    this.flushIntervalId = this.clock.setInterval(() => {
      this.flush().catch((e) => {
        this.options.logger.error(
          `Failed to flush ${this.options.name} buffer`,
          { error: loggableError(e) },
        );
      });
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
      this.flush().catch((e) => {
        this.options.logger.error(
          `Failed to flush ${this.options.name} buffer on size limit`,
          { error: loggableError(e) },
        );
      });
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const toFlush = this.buffer;
    this.buffer = [];

    this.options.logger.debug(
      `Flushing ${this.options.name} buffer (${toFlush.length} items)`,
    );

    await this.options.onFlush(toFlush);
  }
}
