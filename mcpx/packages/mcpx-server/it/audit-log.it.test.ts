import { afterEach, beforeEach, describe, it } from "@jest/globals";
import { withAsyncPolling } from "@mcpx/toolkit-core/time";
import fs from "fs";
import path from "path";
import { env, resetEnv } from "../src/env.js";
import { getTestHarness, transportTypes } from "./utils.js";

describe.each(transportTypes)("Audit Log Service over %s", (transportType) => {
  let testHarness: ReturnType<typeof getTestHarness>;

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env["AUDIT_LOG_FLUSH_INTERVAL_IN_SEC"] = "1";
    resetEnv();
    await deleteAllAuditLogFiles();
    testHarness = getTestHarness();
    await testHarness.initialize(transportType);
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    resetEnv();
    await deleteAllAuditLogFiles();
    await testHarness.shutdown();
  });

  it("should persist events to file", async () => {
    await testHarness.client.callTool({
      name: "echo-service__echo",
      arguments: { message: "The sound of silence?" },
    });

    // poll for 10 seconds
    const auditFile = await withAsyncPolling({
      maxAttempts: 200,
      sleepTimeMs: 50,
      getValue: async () => await findLatestAuditLogFile(),
      found: (fileContent): fileContent is string => Boolean(fileContent),
    });

    console.log("Audit file content:", auditFile);
    expect(auditFile).toBeDefined();
    // split by lines
    const lines = auditFile.split("\n").filter(Boolean);
    expect(lines.length).toBe(2); // 1 for initial config applied, 1 for echo service call
    const configAppliedEvent = JSON.parse(lines[0]!);
    const toolUsedEvent = JSON.parse(lines[1]!);

    // Both should be written at the same flush - createdAt should be the same
    const configAppliedCreatedAt = Date.parse(configAppliedEvent.createdAt);
    const toolUsedCreatedAt = Date.parse(toolUsedEvent.createdAt);
    expect(configAppliedCreatedAt).toEqual(toolUsedCreatedAt);

    // However timestamp of each event is different as they happen at different times
    const configAppliedTimestamp = Date.parse(configAppliedEvent.timestamp);
    const toolUsedTimestamp = Date.parse(toolUsedEvent.timestamp);
    expect(configAppliedTimestamp).not.toEqual(toolUsedTimestamp);

    // Applied Config Content
    expect(configAppliedEvent.eventType).toBe("config_applied");
    expect(configAppliedEvent.payload.version).toEqual(1);

    // Tool Used Content
    expect(toolUsedEvent.eventType).toBe("tool_used");
    expect(toolUsedEvent.payload).toMatchSnapshot();
  });
});

async function deleteAllAuditLogFiles(): Promise<void> {
  try {
    const files = await fs.promises.readdir(env.AUDIT_LOG_DIR);
    await Promise.all(
      files.map((file) =>
        fs.promises.unlink(path.join(env.AUDIT_LOG_DIR, file)),
      ),
    );
    console.log("All files deleted successfully", { count: files.length });
  } catch (err) {
    console.error("Error deleting files:", err);
  }
}

async function findLatestAuditLogFile(): Promise<string | null> {
  try {
    const files = await fs.promises.readdir(env.AUDIT_LOG_DIR);
    if (files.length === 0) {
      return null;
    }

    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(env.AUDIT_LOG_DIR, file);
        const stats = await fs.promises.stat(filePath);
        return { file, time: stats.mtime };
      }),
    );

    // Find the latest file
    const latest = fileStats.reduce((a, b) => (a.time > b.time ? a : b));

    // Read and return its content
    const content = await fs.promises.readFile(
      path.join(env.AUDIT_LOG_DIR, latest.file),
      "utf-8",
    );
    console.log("Latest file read successfully:", path.basename(latest.file));
    return content;
  } catch (err) {
    console.error("Error finding latest file:", err);
    return null;
  }
}
