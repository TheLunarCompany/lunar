import { ManualClock } from "@mcpx/toolkit-core/time";
import { SystemStateTracker } from "./system-state.js";
import { noOpLogger } from "@mcpx/toolkit-core/logging";

describe("MetricRecorder", () => {
  it("should initialize with default values", () => {
    const clock = new ManualClock();
    const recorder = new SystemStateTracker(clock, noOpLogger);
    const metrics = recorder.export();
    expect(metrics.usage.callCount).toBe(0);
    expect(metrics.usage.lastCalledAt).toBeUndefined();
    expect(Object.keys(metrics.connectedClients).length).toBe(0);
    expect(Object.keys(metrics.targetServers).length).toBe(0);
  });

  it("should record client connection", () => {
    const clock = new ManualClock();
    const recorder = new SystemStateTracker(clock, noOpLogger);
    recorder.recordClientConnected({
      sessionId: "session1",
      client: {
        consumerTag: "consumer1",
        clientId: "client-1",
      },
    });

    const metrics = recorder.export();
    const client = metrics.connectedClients.find(
      (c) => c.sessionId === "session1",
    );
    expect(client).toBeDefined();
    expect(client!.usage.callCount).toBe(0);
    expect(client!.consumerTag).toBe("consumer1");

    expect(metrics.usage.callCount).toBe(0);
    expect(metrics.usage.lastCalledAt).toBeUndefined();

    expect(Object.keys(metrics.targetServers).length).toBe(0);
  });

  it("should record client disconnection", () => {
    const clock = new ManualClock();
    const recorder = new SystemStateTracker(clock, noOpLogger);
    recorder.recordClientConnected({
      sessionId: "session1",
      client: {
        consumerTag: "consumer1",
        clientId: "client-1",
      },
    });
    recorder.recordClientConnected({
      sessionId: "session2",
      client: {
        clientId: "client-2",
      },
    });
    const metricsA = recorder.export();
    expect(metricsA.connectedClients.length).toBe(2);

    recorder.recordClientDisconnected({ sessionId: "session1" });
    const metricsB = recorder.export();
    expect(metricsB.connectedClients.length).toBe(1);
  });

  it("should record target server connection", () => {
    const clock = new ManualClock();
    const recorder = new SystemStateTracker(clock, noOpLogger);
    recorder.recordTargetServerConnection({
      _type: "stdio",
      state: { type: "connected" },
      command: "start-server",
      name: "server1",
      originalTools: [],
      tools: [
        {
          name: "tool1",
          description: "Test tool",
          inputSchema: {
            type: "object",
          },
          parameters: [
            { name: "owner", description: "The owner" },
            { name: "repo" },
          ],
        },
        {
          name: "tool2",
          description: "Another tool",
          inputSchema: { type: "object" },
          parameters: [],
        },
        {
          name: "tool3",
          description: "No params tool",
          inputSchema: { type: "object" },
        },
      ],
    });

    const metrics = recorder.export();
    expect(metrics.targetServers.length).toBe(1);

    const server = metrics.targetServers.find((s) => s.name === "server1");
    expect(server).toBeDefined();
    expect(server!.usage.callCount).toBe(0);
    expect(server!.tools.length).toBe(3);
    expect(server!.tools[0]!.name).toBe("tool1");
    expect(server!.tools[0]!.description).toBe("Test tool");
    expect(server!.tools[0]!.parameters).toEqual([
      { name: "owner", description: "The owner" },
      { name: "repo" },
    ]);
    expect(server!.tools[1]!.parameters).toEqual([]);
    expect(server!.tools[2]!.parameters).toBeUndefined();

    expect(metrics.usage.callCount).toBe(0);
    expect(metrics.usage.lastCalledAt).toBeUndefined();
  });

  it("should record target server disconnection", () => {
    const clock = new ManualClock();
    const recorder = new SystemStateTracker(clock, noOpLogger);
    recorder.recordTargetServerConnection({
      _type: "stdio",
      state: { type: "connected" },
      command: "start-server",
      name: "server1",
      originalTools: [],
      tools: [
        {
          name: "tool1",
          description: "Test tool",
          inputSchema: {
            type: "object",
          },
        },
      ],
    });
    recorder.recordTargetServerConnection({
      _type: "stdio",
      state: { type: "connected" },
      command: "start-server",
      name: "server2",
      originalTools: [],
      tools: [
        {
          name: "tool2",
          description: "Another tool",
          inputSchema: {
            type: "object",
          },
        },
      ],
    });

    const metricsA = recorder.export();
    expect(metricsA.targetServers.length).toBe(2);

    recorder.recordTargetServerDisconnected({ name: "server1" });
    const metricsB = recorder.export();
    expect(metricsB.targetServers.length).toBe(1);
  });

  it("should record tool usage", () => {
    const clock = new ManualClock();
    const recorder = new SystemStateTracker(clock, noOpLogger);
    recorder.recordTargetServerConnection({
      _type: "stdio",
      state: { type: "connected" },
      command: "start-server",
      name: "service1",
      originalTools: [],
      tools: [
        {
          name: "tool1",
          description: "Test tool",
          inputSchema: {
            type: "object",
          },
        },
      ],
    });
    recorder.recordToolCall({
      toolName: "tool1",
      targetServerName: "service1",
    });

    const metrics = recorder.export();

    const server = metrics.targetServers.find((s) => s.name === "service1");
    expect(server).toBeDefined();
    expect(server!.usage.callCount).toBe(1);
  });

  it("should record tool usage with session ID", () => {
    const timeA = new Date();
    const clock = new ManualClock(timeA);
    const recorder = new SystemStateTracker(clock, noOpLogger);
    recorder.recordTargetServerConnection({
      _type: "stdio",
      state: { type: "connected" },
      command: "start-server",
      name: "service1",
      originalTools: [],
      tools: [
        {
          name: "tool1",
          description: "Test tool",
          inputSchema: {
            type: "object",
          },
        },
      ],
    });
    recorder.recordTargetServerConnection({
      _type: "stdio",
      state: { type: "connected" },
      command: "start-server",
      name: "service2",
      originalTools: [],
      tools: [
        {
          name: "tool2",
          description: "Another tool",
          inputSchema: {
            type: "object",
          },
        },
      ],
    });

    const metricsA = recorder.export();
    expect(metricsA.lastUpdatedAt.getTime()).toBe(timeA.getTime());

    const timeB = new Date(timeA.getTime() + 1000);
    clock.set(timeB);

    recorder.recordClientConnected({
      sessionId: "session1",
      client: { clientId: "client-1" },
    });

    const metricsB = recorder.export();
    expect(metricsB.lastUpdatedAt.getTime()).toBe(timeB.getTime());
    expect(metricsB.connectedClients.length).toBe(1);
    expect(metricsB.connectedClients[0]!.sessionId).toBe("session1");

    const timeC = new Date(timeB.getTime() + 1000);
    clock.set(timeC);

    recorder.recordToolCall({
      toolName: "tool1",
      targetServerName: "service1",
      sessionId: "session1",
    });

    const timeD = new Date(timeC.getTime() + 1000);
    clock.set(timeD);

    recorder.recordToolCall({
      toolName: "tool2",
      targetServerName: "service2",
      sessionId: "session1",
    });

    const metrics = recorder.export();
    expect(metrics.lastUpdatedAt.getTime()).toBe(timeD.getTime());
    expect(metrics.usage.callCount).toBe(2);
    expect(metrics.usage.lastCalledAt?.getTime()).toBe(timeD.getTime());
    expect(metrics.targetServers.length).toBe(2);

    const service1 = metrics.targetServers.find((s) => s.name === "service1");
    expect(service1).toBeDefined();
    expect(service1!.usage.callCount).toBe(1);
    expect(service1!.usage.lastCalledAt?.getTime()).toBe(timeC.getTime());

    const service2 = metrics.targetServers.find((s) => s.name === "service2");
    expect(service2).toBeDefined();
    expect(service2!.usage.callCount).toBe(1);
    expect(service2!.usage.lastCalledAt?.getTime()).toBe(timeD.getTime());
  });

  describe("#updateTargetServerTools", () => {
    const originalTools = [
      { name: "tool1", inputSchema: { type: "object" as const } },
      { name: "tool2", inputSchema: { type: "object" as const } },
    ];

    it("should update tools when filtering reduces visible tools", () => {
      const clock = new ManualClock();
      const recorder = new SystemStateTracker(clock, noOpLogger);
      recorder.recordTargetServerConnection({
        _type: "stdio",
        state: { type: "connected" },
        command: "start-server",
        name: "server1",
        originalTools,
        tools: originalTools,
      });

      const metricsBefore = recorder.export();
      expect(metricsBefore.targetServers[0]?.tools).toHaveLength(2);

      // Simulate approved tools filter reducing visible tools
      recorder.updateTargetServerTools({
        name: "server1",
        tools: [{ name: "tool1", inputSchema: { type: "object" as const } }],
        originalTools,
      });

      const metricsAfter = recorder.export();
      expect(metricsAfter.targetServers[0]?.tools).toHaveLength(1);
      expect(metricsAfter.targetServers[0]?.tools[0]?.name).toBe("tool1");
      expect(metricsAfter.targetServers[0]?.originalTools).toHaveLength(2);
    });

    it("should preserve tool usage when tool still exists after update", () => {
      const clock = new ManualClock();
      const recorder = new SystemStateTracker(clock, noOpLogger);
      recorder.recordTargetServerConnection({
        _type: "stdio",
        state: { type: "connected" },
        command: "start-server",
        name: "server1",
        originalTools,
        tools: originalTools,
      });

      recorder.recordToolCall({
        targetServerName: "server1",
        toolName: "tool1",
      });

      const metricsBefore = recorder.export();
      const tool1Before = metricsBefore.targetServers[0]?.tools.find(
        (t) => t.name === "tool1",
      );
      expect(tool1Before?.usage.callCount).toBe(1);

      // Update: tool1 still visible, tool2 filtered out
      recorder.updateTargetServerTools({
        name: "server1",
        tools: [{ name: "tool1", inputSchema: { type: "object" as const } }],
        originalTools,
      });

      const metricsAfter = recorder.export();
      const tool1After = metricsAfter.targetServers[0]?.tools.find(
        (t) => t.name === "tool1",
      );
      expect(tool1After?.usage.callCount).toBe(1);
      expect(metricsAfter.targetServers[0]?.tools).toHaveLength(1);
    });

    it("should notify listeners on tools update", () => {
      const clock = new ManualClock();
      const recorder = new SystemStateTracker(clock, noOpLogger);
      recorder.recordTargetServerConnection({
        _type: "stdio",
        state: { type: "connected" },
        command: "start-server",
        name: "server1",
        originalTools,
        tools: originalTools,
      });

      // Subscribe returns initial state immediately (1 call)
      let notificationCount = 0;
      recorder.subscribe(() => {
        notificationCount++;
      });
      expect(notificationCount).toBe(1);

      // updateTargetServerTools triggers another notification
      recorder.updateTargetServerTools({
        name: "server1",
        tools: [{ name: "tool1", inputSchema: { type: "object" as const } }],
        originalTools,
      });

      expect(notificationCount).toBe(2);
    });

    it("should not notify for non-existent server", () => {
      const clock = new ManualClock();
      const recorder = new SystemStateTracker(clock, noOpLogger);

      // Subscribe returns initial state immediately (1 call)
      let notificationCount = 0;
      recorder.subscribe(() => {
        notificationCount++;
      });
      expect(notificationCount).toBe(1);

      // Update for non-existent server should not trigger notification
      recorder.updateTargetServerTools({
        name: "non-existent",
        tools: originalTools,
        originalTools,
      });

      expect(notificationCount).toBe(1);
    });
  });
});
