import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { systemClock } from "@mcpx/toolkit-core/time";
import fs from "fs";
import os from "os";
import path from "path";
import { resetEnv } from "../src/env.js";
import { FileAuditLogPersistence } from "../src/services/audit-log/audit-log-persistence.js";
import { AuditLogService } from "../src/services/audit-log/audit-log-service.js";

describe("AuditLogService with FileAuditLogPersistence (integration)", () => {
  let tmpDir: string;
  let service: AuditLogService;

  beforeEach(() => {
    process.env["VERSION"] = "test-version";
    process.env["INSTANCE_ID"] = "test-instance";
    resetEnv();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-log-it-"));
    const persistence = new FileAuditLogPersistence(
      tmpDir,
      24,
      systemClock,
      noOpLogger,
    );
    service = new AuditLogService(systemClock, noOpLogger, persistence, 60_000);
  });

  afterEach(async () => {
    await service.shutdown().catch(() => {});
    delete process.env["VERSION"];
    delete process.env["INSTANCE_ID"];
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips events through disk and parses them via the shared schema", async () => {
    service.log({
      eventType: "target_server_added",
      payload: { name: "slack" },
    });
    service.log({
      eventType: "agent_permission_updated",
      payload: {
        name: "dev",
        identityType: "consumers",
        addedServers: ["github"],
        removedServers: [],
      },
    });
    service.log({
      eventType: "catalog_updated",
      payload: {
        addedServers: ["jira"],
        removedServers: [],
        approvedToolsChanges: [
          {
            serverName: "github",
            addedTools: ["create_issue"],
            removedTools: [],
          },
        ],
      },
    });

    // Force flush to disk
    await service.shutdown();

    // Re-create service to read off disk (buffer is empty)
    const persistence = new FileAuditLogPersistence(
      tmpDir,
      24,
      systemClock,
      noOpLogger,
    );
    service = new AuditLogService(systemClock, noOpLogger, persistence, 60_000);

    const events = await service.read({ limit: 10 });
    expect(events).toHaveLength(3);

    // Newest first
    expect(events[0]?.eventType).toBe("catalog_updated");
    expect(events[1]?.eventType).toBe("agent_permission_updated");
    expect(events[2]?.eventType).toBe("target_server_added");

    // Timestamps round-tripped as Date (via z.coerce.date)
    for (const event of events) {
      expect(event.timestamp).toBeInstanceOf(Date);
    }
  });

  it("filters by eventTypes when reading off disk", async () => {
    service.log({
      eventType: "tool_used",
      payload: { toolName: "t", targetServerName: "s" },
    });
    service.log({
      eventType: "target_server_added",
      payload: { name: "slack" },
    });
    await service.shutdown();

    const persistence = new FileAuditLogPersistence(
      tmpDir,
      24,
      systemClock,
      noOpLogger,
    );
    service = new AuditLogService(systemClock, noOpLogger, persistence, 60_000);

    const events = await service.read({
      eventTypes: new Set(["target_server_added"]),
      limit: 10,
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("target_server_added");
  });
});
