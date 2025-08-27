import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { AuditLogService } from "./audit-log-service.js";
import { AuditLogPersistence } from "./audit-log-persistence.js";
import { AuditLog } from "../../model/audit-log-type.js";
import {
  ConfigAppliedPayload,
  ToolUsedPayload,
} from "../../model/audit-log-type.js";
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
    // Set required environment variables for tests
    process.env["VERSION"] = "test-version";
    process.env["INSTANCE_ID"] = "test-instance";

    // Reset env to pick up the new values
    resetEnv();

    persistence = new InMemoryAuditLogPersistence();
    auditLogService = new AuditLogService(
      systemClock,
      noOpLogger,
      persistence,
      1000,
    ); // 1 second flush interval
  });

  afterEach(() => {
    // Restore original env
    delete process.env["VERSION"];
    delete process.env["INSTANCE_ID"];
    // Clear persistence to avoid test interference
    persistence.clear();
  });

  describe("buffer operations", () => {
    it("should add config applied events to buffer", async () => {
      const payload: ConfigAppliedPayload = {
        version: 1,
        config: {
          permissions: {
            default: { _type: "default-allow", block: [] },
            consumers: {},
          },
          toolGroups: [],
          auth: { enabled: false },
          toolExtensions: { services: {} },
        },
      };

      auditLogService.log({
        eventType: "config_applied",
        payload,
      });

      // Wait for flush to happen naturally (1s interval)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Check that events were persisted
      const persistedEvents = persistence.getEvents();
      expect(persistedEvents).toHaveLength(1);
      expect(persistedEvents[0]?.payload).toEqual(payload);
    });

    it("should add tool used events to buffer", async () => {
      const payload: ToolUsedPayload = {
        toolName: "test_tool",
        targetServerName: "test_server",
        args: { param1: "value1", param2: 42 },
        consumerTag: "test_consumer",
      };

      auditLogService.log({
        eventType: "tool_used",
        payload,
      });

      // Wait for flush to happen naturally (1s interval)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Check that events were persisted
      const persistedEvents = persistence.getEvents();
      expect(persistedEvents).toHaveLength(1);
      expect(persistedEvents[0]?.payload).toEqual(payload);
    });
  });

  describe("shutdown", () => {
    it("should flush all events on shutdown", async () => {
      const configPayload: ConfigAppliedPayload = {
        version: 1,
        config: {
          permissions: {
            default: { _type: "default-allow", block: [] },
            consumers: {},
          },
          toolGroups: [],
          auth: { enabled: false },
          toolExtensions: { services: {} },
        },
      };

      const toolPayload: ToolUsedPayload = {
        toolName: "test_tool",
        targetServerName: "test_server",
        args: { param1: "value1", param2: 42 },
        consumerTag: "test_consumer",
      };

      // Add both types of events to buffer
      auditLogService.log({
        eventType: "config_applied",
        payload: configPayload,
      });

      auditLogService.log({
        eventType: "tool_used",
        payload: toolPayload,
      });

      // Wait for flush to happen naturally (1s interval)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await auditLogService.shutdown();

      // Check that all events were persisted
      const persistedEvents = persistence.getEvents();
      expect(persistedEvents).toHaveLength(2);
      expect(persistedEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ payload: configPayload }),
          expect.objectContaining({ payload: toolPayload }),
        ]),
      );
    });
  });
});
