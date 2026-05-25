import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { AuditLogService } from "./audit-log-service.js";
import {
  AuditLogPersistence,
  AuditLogReadOptions,
} from "./audit-log-persistence.js";
import { AuditLog } from "../../model/audit-log-type.js";
import { ToolUsedPayload } from "../../model/audit-log-type.js";
import { matchesEventTypeFilter } from "./audit-log-filter.js";
import { systemClock } from "@mcpx/toolkit-core/time";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { resetEnv } from "../../env.js";

export class InMemoryAuditLogPersistence implements AuditLogPersistence {
  private events: AuditLog[] = [];

  async persist(events: AuditLog[]): Promise<void> {
    this.events.push(...events);
  }

  async cleanup(): Promise<void> {
    // In-memory persistence doesn't need cleanup
  }

  async read({ eventTypes, limit }: AuditLogReadOptions): Promise<AuditLog[]> {
    const newestFirst = [...this.events].reverse();
    const filtered = newestFirst.filter((e) =>
      matchesEventTypeFilter(e, eventTypes),
    );
    return filtered.slice(0, limit);
  }

  getEvents(): AuditLog[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

describe("AuditLogService", () => {
  let auditLogService: AuditLogService;
  let persistence: InMemoryAuditLogPersistence;

  beforeEach(() => {
    process.env["VERSION"] = "test-version";
    process.env["INSTANCE_ID"] = "test-instance";
    resetEnv();

    persistence = new InMemoryAuditLogPersistence();
    auditLogService = new AuditLogService(
      systemClock,
      noOpLogger,
      persistence,
      1000,
    );
  });

  afterEach(() => {
    delete process.env["VERSION"];
    delete process.env["INSTANCE_ID"];
    persistence.clear();
  });

  describe("buffer operations", () => {
    it("buffers and flushes tool_used events", async () => {
      const payload: ToolUsedPayload = {
        toolName: "test_tool",
        targetServerName: "test_server",
        args: { param1: "value1", param2: 42 },
        consumerTag: "test_consumer",
      };

      auditLogService.log({ eventType: "tool_used", payload });

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const persistedEvents = persistence.getEvents();
      expect(persistedEvents).toHaveLength(1);
      expect(persistedEvents[0]?.payload).toEqual(payload);
    });

    it("buffers and flushes target_server_added events", async () => {
      auditLogService.log({
        eventType: "target_server_added",
        payload: { name: "slack" },
      });

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const persistedEvents = persistence.getEvents();
      expect(persistedEvents).toHaveLength(1);
      expect(persistedEvents[0]?.payload).toEqual({ name: "slack" });
    });
  });

  describe("shutdown", () => {
    it("flushes pending events", async () => {
      auditLogService.log({
        eventType: "tool_used",
        payload: {
          toolName: "t",
          targetServerName: "s",
        },
      });
      auditLogService.log({
        eventType: "target_server_added",
        payload: { name: "slack" },
      });

      await auditLogService.shutdown();

      expect(persistence.getEvents()).toHaveLength(2);
    });
  });

  describe("read", () => {
    it("returns newest events first, capped at limit", async () => {
      auditLogService.log({
        eventType: "target_server_added",
        payload: { name: "a" },
      });
      auditLogService.log({
        eventType: "target_server_added",
        payload: { name: "b" },
      });
      auditLogService.log({
        eventType: "target_server_added",
        payload: { name: "c" },
      });

      const events = await auditLogService.read({ limit: 2 });
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.eventType)).toEqual([
        "target_server_added",
        "target_server_added",
      ]);
    });

    it("filters by eventTypes", async () => {
      auditLogService.log({
        eventType: "tool_used",
        payload: { toolName: "t", targetServerName: "s" },
      });
      auditLogService.log({
        eventType: "target_server_added",
        payload: { name: "a" },
      });

      const events = await auditLogService.read({
        eventTypes: new Set(["target_server_added"]),
        limit: 10,
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe("target_server_added");
    });

    it("merges buffered (unflushed) and persisted events newest-first", async () => {
      // Force one event into persistence
      auditLogService.log({
        eventType: "target_server_added",
        payload: { name: "older" },
      });
      await auditLogService.shutdown();

      // Recreate service so the older event lives only on disk
      auditLogService = new AuditLogService(
        systemClock,
        noOpLogger,
        persistence,
        60_000,
      );
      auditLogService.log({
        eventType: "target_server_added",
        payload: { name: "newer" },
      });

      const events = await auditLogService.read({ limit: 10 });
      expect(events).toHaveLength(2);
      expect((events[0]?.payload as { name: string }).name).toBe("newer");
      expect((events[1]?.payload as { name: string }).name).toBe("older");
    });
  });
});
