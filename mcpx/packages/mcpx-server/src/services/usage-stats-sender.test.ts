import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { UsageStatsSender, UsageStatsSocket } from "./usage-stats-sender.js";
import { WebappBoundPayloadOf } from "@mcpx/webapp-protocol/messages";

describe("UsageStatsSender", () => {
  let sender: UsageStatsSender;
  let mockSocket: UsageStatsSocket;
  let emittedMessages: Array<unknown> = [];
  let payloadGenerator: () => WebappBoundPayloadOf<"usage-stats">;

  const waitFor = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  type ToolsConfig = Record<
    string,
    {
      description?: string;
      isCustom: boolean;
      usage: { callCount: number; lastCalledAt?: Date };
    }
  >;

  const createPayload = (
    agentCount: number,
    serverNames: string[],
    toolsPerServer?: ToolsConfig,
  ): WebappBoundPayloadOf<"usage-stats"> => ({
    agents: Array.from({ length: agentCount }, (_, i) => ({
      clientInfo: {
        name: `agent-${i}`,
        version: "1.0.0",
      },
    })),
    targetServers: serverNames.map((name) => ({
      name,
      status: "connected" as const,
      type: "stdio" as const,
      tools: toolsPerServer || {},
    })),
  });

  beforeEach(() => {
    emittedMessages = [];
    mockSocket = {
      emit: (_event, data) => {
        emittedMessages.push(data);
      },
    };
    payloadGenerator = () => createPayload(1, ["server1"]);
  });

  afterEach(() => {
    sender?.stop();
  });

  it("should send immediately on start", () => {
    sender = new UsageStatsSender(noOpLogger, payloadGenerator, 1000);
    sender.start(mockSocket);

    expect(emittedMessages).toHaveLength(1);
  });

  it("should send periodically at specified interval when payload changes", async () => {
    let counter = 0;
    payloadGenerator = () => createPayload(counter++, ["server1"]);

    sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
    sender.start(mockSocket);

    expect(emittedMessages).toHaveLength(1);

    // Wait 120ms: interval at 50ms and 100ms should fire
    await waitFor(120);

    // Should have sent: initial + 2 intervals = 3 messages (or more if timing varies)
    expect(emittedMessages.length).toBeGreaterThanOrEqual(3);
  });

  it("should not send if payload is unchanged", async () => {
    sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
    sender.start(mockSocket);

    expect(emittedMessages).toHaveLength(1);

    await waitFor(120);

    // Should still be 1 because payload hasn't changed
    expect(emittedMessages).toHaveLength(1);
  });

  it("should send when payload changes", async () => {
    let counter = 0;
    payloadGenerator = () => createPayload(counter, ["server1"]);

    sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
    sender.start(mockSocket);

    expect(emittedMessages).toHaveLength(1);

    counter = 1;
    await waitFor(60);

    expect(emittedMessages).toHaveLength(2);

    counter = 2;
    await waitFor(60);

    expect(emittedMessages).toHaveLength(3);
  });

  it("should treat different array orders as same payload", async () => {
    let serverNames = ["server1", "server2"];
    payloadGenerator = () => createPayload(1, serverNames);

    sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
    sender.start(mockSocket);

    expect(emittedMessages).toHaveLength(1);

    // Reverse order
    serverNames = ["server2", "server1"];
    await waitFor(60);

    // Should not send again because content is the same, just different order
    expect(emittedMessages).toHaveLength(1);
  });

  it("should stop interval on stop()", async () => {
    let counter = 0;
    payloadGenerator = () => createPayload(counter++, ["server1"]);

    sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
    sender.start(mockSocket);

    expect(emittedMessages).toHaveLength(1);

    await waitFor(60);
    expect(emittedMessages).toHaveLength(2);

    sender.stop();
    const countAfterStop = emittedMessages.length;

    await waitFor(100);

    // Should not have sent more after stop
    expect(emittedMessages).toHaveLength(countAfterStop);
  });

  it("should reset hash on stop() so first send after restart always goes through", async () => {
    sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);

    sender.start(mockSocket);
    expect(emittedMessages).toHaveLength(1);

    sender.stop();

    // Start again with same payload
    sender.start(mockSocket);

    // Should send again even though payload is same, because hash was reset
    expect(emittedMessages).toHaveLength(2);
  });

  it("should restart cleanly when start() called multiple times", async () => {
    let counter = 0;
    payloadGenerator = () => createPayload(counter++, ["server1"]);

    sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);

    sender.start(mockSocket);
    expect(emittedMessages).toHaveLength(1);

    await waitFor(30);

    // Start again before interval fires
    sender.start(mockSocket);

    // Should have sent immediately on second start
    expect(emittedMessages).toHaveLength(2);

    await waitFor(60);

    // Should continue with new interval
    expect(emittedMessages.length).toBeGreaterThanOrEqual(3);
  });

  describe("tool usage deduplication", () => {
    it("should send when tool callCount changes", async () => {
      const tools: ToolsConfig = {
        "read-file": {
          description: "Read a file",
          isCustom: false,
          usage: { callCount: 1 },
        },
      };

      payloadGenerator = () => createPayload(1, ["server1"], tools);

      sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
      sender.start(mockSocket);

      expect(emittedMessages).toHaveLength(1);

      // Increment callCount
      tools["read-file"]!.usage.callCount = 5;
      await waitFor(60);

      // Should send because callCount changed
      expect(emittedMessages).toHaveLength(2);
    });

    it("should dedupe when tools are in different key order", async () => {
      let toolsOrder1: ToolsConfig = {
        "read-file": {
          description: "Read a file",
          isCustom: false,
          usage: { callCount: 1 },
        },
        "write-file": {
          description: "Write a file",
          isCustom: false,
          usage: { callCount: 2 },
        },
      };

      payloadGenerator = () => createPayload(1, ["server1"], toolsOrder1);

      sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
      sender.start(mockSocket);

      expect(emittedMessages).toHaveLength(1);

      // Create payload with tools in different order but same content
      toolsOrder1 = {
        "write-file": {
          description: "Write a file",
          isCustom: false,
          usage: { callCount: 2 },
        },
        "read-file": {
          description: "Read a file",
          isCustom: false,
          usage: { callCount: 1 },
        },
      };

      await waitFor(60);

      // Should NOT send again - same tools, just different key order
      expect(emittedMessages).toHaveLength(1);
    });

    it("should send when a new tool is added", async () => {
      const tools: ToolsConfig = {
        "read-file": {
          description: "Read a file",
          isCustom: false,
          usage: { callCount: 1 },
        },
      };

      payloadGenerator = () => createPayload(1, ["server1"], tools);

      sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
      sender.start(mockSocket);

      expect(emittedMessages).toHaveLength(1);

      // Add a new tool
      tools["write-file"] = {
        description: "Write a file",
        isCustom: false,
        usage: { callCount: 0 },
      };

      await waitFor(60);

      // Should send because new tool was added
      expect(emittedMessages).toHaveLength(2);
    });

    it("should send when tool metadata changes", async () => {
      const tools: ToolsConfig = {
        "read-file": {
          description: "Read a file",
          isCustom: false,
          usage: { callCount: 1 },
        },
      };

      payloadGenerator = () => createPayload(1, ["server1"], tools);

      sender = new UsageStatsSender(noOpLogger, payloadGenerator, 50);
      sender.start(mockSocket);

      expect(emittedMessages).toHaveLength(1);

      // Change description
      tools["read-file"]!.description = "Read a file from disk";

      await waitFor(60);

      // Should send because tool description changed
      expect(emittedMessages).toHaveLength(2);
    });
  });
});
