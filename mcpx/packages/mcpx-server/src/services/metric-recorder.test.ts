import { ManualClock } from "../utils/time.js";
import { MetricRecorder } from "./metric-recorder.js";

describe("MetricRecorder", () => {
  it("should initialize with default values", () => {
    const clock = new ManualClock();
    const recorder = new MetricRecorder(clock);
    const metrics = recorder.export();
    expect(metrics.usage.callCount).toBe(0);
    expect(metrics.usage.lastCalledAt).toBeUndefined();
    expect(Object.keys(metrics.connectedClients).length).toBe(0);
    expect(Object.keys(metrics.targetServers).length).toBe(0);
  });

  it("should record client connection", () => {
    const clock = new ManualClock();
    const recorder = new MetricRecorder(clock);
    recorder.recordClientConnected({
      sessionId: "session1",
      client: {
        consumerTag: "consumer1",
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
    const recorder = new MetricRecorder(clock);
    recorder.recordClientConnected({
      sessionId: "session1",
      client: {
        consumerTag: "consumer1",
      },
    });
    recorder.recordClientConnected({ sessionId: "session2", client: {} });
    const metricsA = recorder.export();
    expect(metricsA.connectedClients.length).toBe(2);

    recorder.recordClientDisconnected({ sessionId: "session1" });
    const metricsB = recorder.export();
    expect(metricsB.connectedClients.length).toBe(1);
  });

  it("should record target server connection", () => {
    const clock = new ManualClock();
    const recorder = new MetricRecorder(clock);
    recorder.recordTargetServerConnected({
      name: "server1",
      tools: [{ name: "tool1", description: "Test tool" }],
    });

    const metrics = recorder.export();
    expect(metrics.targetServers.length).toBe(1);

    const server = metrics.targetServers.find((s) => s.name === "server1");
    expect(server).toBeDefined();
    expect(server!.usage.callCount).toBe(0);
    expect(server!.tools.length).toBe(1);
    expect(server!.tools[0]!.name).toBe("tool1");
    expect(server!.tools[0]!.description).toBe("Test tool");

    expect(metrics.usage.callCount).toBe(0);
    expect(metrics.usage.lastCalledAt).toBeUndefined();
  });

  it("should record target server disconnection", () => {
    const clock = new ManualClock();
    const recorder = new MetricRecorder(clock);
    recorder.recordTargetServerConnected({
      name: "server1",
      tools: [{ name: "tool1", description: "Test tool" }],
    });
    recorder.recordTargetServerConnected({
      name: "server2",
      tools: [{ name: "tool2", description: "Another tool" }],
    });

    const metricsA = recorder.export();
    expect(metricsA.targetServers.length).toBe(2);

    recorder.recordTargetServerDisconnected({ name: "server1" });
    const metricsB = recorder.export();
    expect(metricsB.targetServers.length).toBe(1);
  });

  it("should record tool usage", () => {
    const clock = new ManualClock();
    const recorder = new MetricRecorder(clock);
    recorder.recordTargetServerConnected({
      name: "service1",
      tools: [{ name: "tool1", description: "Test tool" }],
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
    const recorder = new MetricRecorder(clock);
    recorder.recordTargetServerConnected({
      name: "service1",
      tools: [{ name: "tool1", description: "Test tool" }],
    });
    recorder.recordTargetServerConnected({
      name: "service2",
      tools: [{ name: "tool2", description: "Another tool" }],
    });

    const metricsA = recorder.export();
    expect(metricsA.lastUpdatedAt.getTime()).toBe(timeA.getTime());

    const timeB = new Date(timeA.getTime() + 1000);
    clock.set(timeB);

    recorder.recordClientConnected({ sessionId: "session1", client: {} });

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
});
