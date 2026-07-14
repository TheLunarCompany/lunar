import { Clock } from "@mcpx/toolkit-core/time";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { auditLogEntrySchema } from "@mcpx/shared-model";
import fs from "fs";
import { DateTime } from "luxon";
import path from "path";
import { Logger } from "winston";
import { LOG_FLAGS } from "../../log-flags.js";
import { AuditLog, AuditLogEvent } from "../../model/audit-log-type.js";
import { matchesEventTypeFilter } from "./audit-log-filter.js";

export interface AuditLogReadOptions {
  eventTypes?: Set<AuditLogEvent["eventType"]>;
  limit: number;
}

export interface AuditLogPersistence {
  persist(events: AuditLog[]): Promise<void>;
  cleanup(): Promise<void>;
  read(options: AuditLogReadOptions): Promise<AuditLog[]>;
}

export class FileAuditLogPersistence implements AuditLogPersistence {
  constructor(
    private readonly auditLogDir: string,
    private readonly retentionHours: number,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {
    this.ensureDirectoryExists();
  }

  async persist(events: AuditLog[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // Clean up old files before persisting new events
    await this.cleanup();

    // Group events by hour for efficient batching
    const eventsByHour = new Map<string, string[]>();

    const persistTime = this.clock.now();
    // Pre-serialize all events to avoid repeated JSON.stringify calls
    for (const event of events) {
      event.createdAt = persistTime;
      const hourKey = this.getHourKey(event.timestamp);
      const currentHourEvents = eventsByHour.get(hourKey) || [];
      currentHourEvents.push(JSON.stringify(event));
      eventsByHour.set(hourKey, currentHourEvents);
    }

    // Write each hour group efficiently
    const writePromises = Array.from(eventsByHour.entries()).map(
      async ([hourKey, jsonLines]) => {
        const filename = this.getFilenameForHour(hourKey);
        const filepath = path.join(this.auditLogDir, filename);

        try {
          await fs.promises.access(filepath).catch(async () => {
            await fs.promises.writeFile(filepath, "");
          });

          // Single write operation with all lines concatenated
          const content = jsonLines.join("\n") + "\n";
          await fs.promises.appendFile(filepath, content);

          if (LOG_FLAGS.LOG_AUDIT_LOG_PERSISTENCE) {
            this.logger.debug(
              `Persisted ${jsonLines.length} events to ${filename}`,
            );
          }
        } catch (error) {
          this.logger.error(`Failed to persist events to ${filename}`, {
            error,
          });
          throw error;
        }
      },
    );

    // Wait for all writes to complete
    await Promise.all(writePromises);
  }

  async read({ eventTypes, limit }: AuditLogReadOptions): Promise<AuditLog[]> {
    const files = await this.getAuditLogFiles();
    const eligible = files
      .map((f) => ({ name: f, time: this.parseTimeFromFilename(f) }))
      .filter((f): f is { name: string; time: Date } => f.time !== null)
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    const results: AuditLog[] = [];
    for (const { name } of eligible) {
      const content = await fs.promises
        .readFile(path.join(this.auditLogDir, name), "utf8")
        .catch((error) => {
          this.logger.warn(`Failed to read audit log file: ${name}`, { error });
          return "";
        });
      if (!content) continue;

      const lines = content.split("\n");
      // Events are appended in chronological order within an hour-bucket file,
      // so iterating in reverse yields newest-first; we can push directly into
      // results without a per-file resort.
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        let json: unknown;
        try {
          json = JSON.parse(line);
        } catch (error) {
          this.logger.warn(`Unparseable audit log line in ${name}`, { error });
          continue;
        }
        const parsed = auditLogEntrySchema.safeParse(json);
        if (!parsed.success) {
          this.logger.warn(`Invalid audit log line in ${name}`, {
            error: loggableError(parsed.error),
          });
          continue;
        }
        if (!matchesEventTypeFilter(parsed.data, eventTypes)) continue;
        results.push(parsed.data);
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  async cleanup(): Promise<void> {
    try {
      const cutoffTime = DateTime.fromJSDate(this.clock.now())
        .minus({ hours: this.retentionHours })
        .toJSDate();

      const files = await this.getAuditLogFiles();
      let deletedCount = 0;

      for (const file of files) {
        const fileTime = this.parseTimeFromFilename(file);
        if (!fileTime) continue;
        if (fileTime < cutoffTime) {
          try {
            await fs.promises.unlink(path.join(this.auditLogDir, file));
            deletedCount++;
            this.logger.debug(`Deleted old audit log file: ${file}`);
          } catch (error) {
            this.logger.warn(`Failed to delete old audit log file: ${file}`, {
              error,
            });
          }
        }
      }

      if (deletedCount > 0) {
        this.logger.info(`Cleaned up ${deletedCount} old audit log files`);
      }
    } catch (error) {
      this.logger.error("Error during audit log cleanup", { error });
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.promises.access(this.auditLogDir);
    } catch {
      await fs.promises.mkdir(this.auditLogDir, { recursive: true });
      this.logger.debug(`Created audit log directory: ${this.auditLogDir}`);
    }
  }

  private getHourKey(timestamp: Date): string {
    return timestamp.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  }

  private getFilenameForHour(hourKey: string): string {
    return `audit-${hourKey}.jsonl`;
  }

  private async getAuditLogFiles(): Promise<string[]> {
    try {
      return await fs.promises.readdir(this.auditLogDir);
    } catch (error) {
      this.logger.warn("Failed to read audit log directory", { error });
      return [];
    }
  }

  private parseTimeFromFilename(filename: string): Date | null {
    try {
      // Extract time from filename like "audit-2025-07-25T13.jsonl"
      const match = filename.match(/audit-(\d{4}-\d{2}-\d{2}T\d{2})\.jsonl/);
      if (match) {
        return new Date(match[1] + ":00:00.000Z");
      }
    } catch (error) {
      this.logger.warn(`Failed to parse time from filename: ${filename}`, {
        error,
      });
    }
    return null;
  }
}
