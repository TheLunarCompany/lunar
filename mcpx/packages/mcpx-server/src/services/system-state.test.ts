import { ManualClock } from "@mcpx/toolkit-core/time";
import { DateTime } from "luxon";
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
      prompts: [],
      originalPrompts: [],
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
      prompts: [],
      originalPrompts: [],
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
      prompts: [],
      originalPrompts: [],
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
      prompts: [],
      originalPrompts: [],
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
      prompts: [],
      originalPrompts: [],
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
      prompts: [],
      originalPrompts: [],
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
        prompts: [],
        originalPrompts: [],
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
        prompts: [],
        originalPrompts: [],
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
        prompts: [],
        originalPrompts: [],
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

    it("should preserve annotations through recordTargetServerConnection", () => {
      const clock = new ManualClock();
      const recorder = new SystemStateTracker(clock, noOpLogger);
      recorder.recordTargetServerConnection({
        _type: "stdio",
        state: { type: "connected" },
        command: "start-server",
        name: "server1",
        originalTools: [],
        prompts: [],
        originalPrompts: [],
        tools: [
          {
            name: "read-tool",
            inputSchema: { type: "object" as const },
            annotations: { readOnlyHint: true, idempotentHint: true },
          },
          {
            name: "no-annotations-tool",
            inputSchema: { type: "object" as const },
          },
        ],
      });

      const { targetServers } = recorder.export();
      const server = targetServers.find((s) => s.name === "server1");
      const readTool = server?.tools.find((t) => t.name === "read-tool");
      const noAnnotationsTool = server?.tools.find(
        (t) => t.name === "no-annotations-tool",
      );

      expect(readTool?.annotations).toEqual({
        readOnlyHint: true,
        idempotentHint: true,
      });
      expect(noAnnotationsTool?.annotations).toBeUndefined();
    });

    it("should preserve annotations through updateTargetServerTools", () => {
      const clock = new ManualClock();
      const recorder = new SystemStateTracker(clock, noOpLogger);
      recorder.recordTargetServerConnection({
        _type: "stdio",
        state: { type: "connected" },
        command: "start-server",
        name: "server1",
        originalTools: [],
        prompts: [],
        originalPrompts: [],
        tools: [],
      });

      recorder.updateTargetServerTools({
        name: "server1",
        tools: [
          {
            name: "destructive-tool",
            inputSchema: { type: "object" as const },
            annotations: { destructiveHint: true },
          },
        ],
        originalTools: [],
      });

      const { targetServers } = recorder.export();
      const tool = targetServers
        .find((s) => s.name === "server1")
        ?.tools.find((t) => t.name === "destructive-tool");

      expect(tool?.annotations).toEqual({ destructiveHint: true });
    });
  });
});

describe("connectedClientClusters — identity-based grouping", () => {
  function newRecorder(): SystemStateTracker {
    return new SystemStateTracker(new ManualClock(), noOpLogger);
  }

  function connect(
    recorder: SystemStateTracker,
    sessionId: string,
    opts: {
      clientId?: string;
      consumerTag?: string;
      clientName?: string;
    } = {},
  ): void {
    recorder.recordClientConnected({
      sessionId,
      client: {
        clientId: opts.clientId ?? sessionId,
        consumerTag: opts.consumerTag,
        clientInfo: opts.clientName ? { name: opts.clientName } : undefined,
      },
    });
  }

  describe("when a session has a consumerTag", () => {
    it("→ produces a consumerTag cluster keyed by the tag", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { consumerTag: "team-a", clientName: "cursor" });
      const [cluster, ...rest] = recorder.export().connectedClientClusters;
      expect(rest).toEqual([]);
      expect(cluster).toEqual({
        identityType: "consumerTag",
        consumerTag: "team-a",
        clientNames: ["cursor"],
        sessionIds: ["s1"],
        usage: { callCount: 0, lastCalledAt: undefined },
      });
    });

    it("→ aggregates distinct clientNames riding the same tag", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { consumerTag: "team-a", clientName: "cursor" });
      connect(recorder, "s2", {
        consumerTag: "team-a",
        clientName: "claude-ai",
      });
      connect(recorder, "s3", { consumerTag: "team-a", clientName: "cursor" });
      const clusters = recorder.export().connectedClientClusters;
      expect(clusters).toHaveLength(1);
      const [cluster] = clusters;
      if (cluster?.identityType !== "consumerTag") {
        throw new Error("expected consumerTag cluster");
      }
      expect(cluster.consumerTag).toBe("team-a");
      expect(cluster.clientNames).toEqual(["cursor", "claude-ai"]);
      expect(cluster.sessionIds).toEqual(["s1", "s2", "s3"]);
    });

    it("→ different tags split into separate clusters even with the same client", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { consumerTag: "team-a", clientName: "cursor" });
      connect(recorder, "s2", { consumerTag: "team-b", clientName: "cursor" });
      const clusters = recorder.export().connectedClientClusters;
      expect(clusters).toHaveLength(2);
      expect(clusters.every((c) => c.identityType === "consumerTag")).toBe(
        true,
      );
      const tags = clusters.map((c) =>
        c.identityType === "consumerTag" ? c.consumerTag : null,
      );
      expect(tags).toHaveLength(2);
      expect(tags).toEqual(expect.arrayContaining(["team-a", "team-b"]));
      const clientNames = clusters.map((c) =>
        c.identityType === "consumerTag" ? c.clientNames : null,
      );
      expect(clientNames).toEqual([["cursor"], ["cursor"]]); // To each their own!
    });

    it("→ clientNames is empty when no underlying client reports a name", () => {
      // Not very realistic, but MCP SDK makes clientName optional, so...
      const recorder = newRecorder();
      connect(recorder, "s1", { consumerTag: "team-a" });
      const [cluster, ...rest] = recorder.export().connectedClientClusters;
      expect(rest).toHaveLength(0);
      if (cluster?.identityType !== "consumerTag") {
        throw new Error("expected consumerTag cluster");
      }
      expect(cluster.clientNames).toEqual([]);
    });
  });

  describe("when a session has only a clientName", () => {
    it("→ produces a clientName cluster keyed by the name", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { clientName: "cursor" });
      const [cluster, ...rest] = recorder.export().connectedClientClusters;
      expect(rest).toEqual([]);
      expect(cluster).toEqual({
        identityType: "clientName",
        clientName: "cursor",
        sessionIds: ["s1"],
        usage: { callCount: 0, lastCalledAt: undefined },
      });
    });

    it("→ multiple sessions with the same clientName collapse into one cluster", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { clientName: "cursor" });
      connect(recorder, "s2", { clientName: "cursor" });
      const clusters = recorder.export().connectedClientClusters;
      expect(clusters).toHaveLength(1);
      const [cluster] = clusters;
      expect(cluster?.identityType).toBe("clientName");
      expect(cluster?.sessionIds).toEqual(["s1", "s2"]);
    });
  });

  describe("when a session has neither a consumerTag nor a clientName", () => {
    // Very bad clients be like. Shouldn't really happen, but catch-all is important for robustness.
    it("→ produces an anonymous cluster with no name fields", () => {
      const recorder = newRecorder();
      connect(recorder, "s1");
      const [cluster, ...rest] = recorder.export().connectedClientClusters;
      expect(rest).toEqual([]);
      expect(cluster).toEqual({
        identityType: "anonymous",
        sessionIds: ["s1"],
        usage: { callCount: 0, lastCalledAt: undefined },
      });
    });

    it("→ all anonymous sessions collapse into a single cluster", () => {
      const recorder = newRecorder();
      connect(recorder, "s1");
      connect(recorder, "s2");
      const clusters = recorder.export().connectedClientClusters;
      expect(clusters).toHaveLength(1);
      const [cluster] = clusters;
      expect(cluster?.identityType).toBe("anonymous");
      expect(cluster?.sessionIds).toEqual(["s1", "s2"]);
    });
  });

  describe("when a mix of identities is connected", () => {
    it("→ tag, named-only, and anonymous sessions each produce their own cluster", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { consumerTag: "team-a", clientName: "cursor" });
      connect(recorder, "s2", { clientName: "claude-ai" });
      connect(recorder, "s3");
      const clusters = recorder.export().connectedClientClusters;
      expect(clusters).toHaveLength(3);
      const types = clusters.map((c) => c.identityType).sort();
      expect(types).toEqual(["anonymous", "clientName", "consumerTag"]);
    });

    it("→ consumerTag wins over clientName when a session has both", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { consumerTag: "team-a", clientName: "cursor" });
      connect(recorder, "s2", { clientName: "cursor" });
      const clusters = recorder.export().connectedClientClusters;
      expect(clusters).toHaveLength(2);
      const tagCluster = clusters.find((c) => c.identityType === "consumerTag");
      const nameCluster = clusters.find((c) => c.identityType === "clientName");
      expect(tagCluster?.sessionIds).toEqual(["s1"]);
      expect(nameCluster?.sessionIds).toEqual(["s2"]);
    });

    it("→ multiple tags + multiple clientNames + anonymous coexist independently", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { consumerTag: "team-a", clientName: "cursor" });
      connect(recorder, "s2", {
        consumerTag: "team-a",
        clientName: "claude-ai",
      });
      connect(recorder, "s3", { consumerTag: "team-b", clientName: "cursor" });
      connect(recorder, "s4", { clientName: "windsurf" });
      connect(recorder, "s5", { clientName: "windsurf" });
      connect(recorder, "s6", { clientName: "inspector-client" });
      connect(recorder, "s7");
      connect(recorder, "s8");

      const clusters = recorder.export().connectedClientClusters;
      // team-a, team-b, windsurf, inspector-client, anonymous
      expect(clusters).toHaveLength(5);

      const teamA = clusters.find(
        (c) => c.identityType === "consumerTag" && c.consumerTag === "team-a",
      );
      const teamB = clusters.find(
        (c) => c.identityType === "consumerTag" && c.consumerTag === "team-b",
      );
      const windsurf = clusters.find(
        (c) => c.identityType === "clientName" && c.clientName === "windsurf",
      );
      const inspector = clusters.find(
        (c) =>
          c.identityType === "clientName" &&
          c.clientName === "inspector-client",
      );
      const anon = clusters.find((c) => c.identityType === "anonymous");

      if (!teamA || !teamB || !windsurf || !inspector || !anon) {
        throw new Error("expected all clusters to be present");
      }
      expect(teamA.identityType === "consumerTag" && teamA.clientNames).toEqual(
        ["cursor", "claude-ai"],
      );
      expect(teamA.sessionIds).toEqual(["s1", "s2"]);
      expect(teamB.identityType === "consumerTag" && teamB.clientNames).toEqual(
        ["cursor"],
      );
      expect(teamB.sessionIds).toEqual(["s3"]);
      expect(windsurf.sessionIds).toEqual(["s4", "s5"]);
      expect(inspector.sessionIds).toEqual(["s6"]);
      expect(anon.sessionIds).toEqual(["s7", "s8"]);
    });

    it("→ disconnect removes a session from its cluster without affecting others", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { consumerTag: "team-a", clientName: "cursor" });
      connect(recorder, "s2", {
        consumerTag: "team-a",
        clientName: "claude-ai",
      });
      connect(recorder, "s3", { clientName: "windsurf" });
      recorder.recordClientDisconnected({ sessionId: "s2" });

      const clusters = recorder.export().connectedClientClusters;
      const teamA = clusters.find(
        (c) => c.identityType === "consumerTag" && c.consumerTag === "team-a",
      );
      const windsurf = clusters.find(
        (c) => c.identityType === "clientName" && c.clientName === "windsurf",
      );
      expect(teamA?.sessionIds).toEqual(["s1"]);
      expect(
        teamA?.identityType === "consumerTag" && teamA.clientNames,
      ).toEqual(["cursor"]);
      expect(windsurf?.sessionIds).toEqual(["s3"]);
    });

    it("→ a cluster vanishes once its last session disconnects", () => {
      const recorder = newRecorder();
      connect(recorder, "s1", { clientName: "cursor" });
      connect(recorder, "s2", { consumerTag: "team-a" });

      const clustersBefore = recorder.export().connectedClientClusters;
      expect(clustersBefore).toHaveLength(2);

      recorder.recordClientDisconnected({ sessionId: "s1" });

      const clustersAfter = recorder.export().connectedClientClusters;
      expect(clustersAfter).toHaveLength(1);
      expect(clustersAfter[0]?.identityType).toBe("consumerTag");
    });
  });

  describe("usage aggregation across sessions in a cluster", () => {
    function setupServer(
      recorder: SystemStateTracker,
      name: string,
      toolNames: string[],
    ): void {
      recorder.recordTargetServerConnection({
        _type: "stdio",
        state: { type: "connected" },
        command: "x",
        name,
        originalTools: [],
        prompts: [],
        originalPrompts: [],
        tools: toolNames.map((toolName) => ({
          name: toolName,
          description: "",
          inputSchema: { type: "object" as const },
        })),
      });
    }

    function call(
      recorder: SystemStateTracker,
      sessionId: string,
      serverName: string,
      toolName: string,
      times = 1,
    ): void {
      for (let i = 0; i < times; i++) {
        recorder.recordToolCall({
          targetServerName: serverName,
          toolName,
          sessionId,
        });
      }
    }

    it("→ end-to-end: many servers, many tools, many clients, usage tunnels into the right cluster", () => {
      const t0 = DateTime.fromISO("2026-05-01T10:00:00.000Z", { zone: "utc" });
      const clock = new ManualClock(t0.toJSDate());
      const recorder = new SystemStateTracker(clock, noOpLogger);
      setupServer(recorder, "github", ["create_issue", "list_repos"]);
      setupServer(recorder, "slack", ["post_message"]);
      setupServer(recorder, "linear", ["create_ticket"]);

      // team-a tag, two underlying clients, three sessions total
      connect(recorder, "ta-cursor-1", {
        consumerTag: "team-a",
        clientName: "cursor",
      });
      connect(recorder, "ta-cursor-2", {
        consumerTag: "team-a",
        clientName: "cursor",
      });
      connect(recorder, "ta-claude-1", {
        consumerTag: "team-a",
        clientName: "claude-ai",
      });

      // a clientName-only cluster
      connect(recorder, "ws-1", { clientName: "windsurf" });
      connect(recorder, "ws-2", { clientName: "windsurf" });

      // an anonymous cluster
      connect(recorder, "anon-1");

      const teamACursorCallTime = t0.plus({ seconds: 1 });
      clock.set(teamACursorCallTime.toJSDate());
      call(recorder, "ta-cursor-1", "github", "create_issue", 3);

      const teamACursor2CallTime = t0.plus({ seconds: 2 });
      clock.set(teamACursor2CallTime.toJSDate());
      call(recorder, "ta-cursor-2", "slack", "post_message", 2);

      const teamAClaudeCallTime = t0.plus({ seconds: 3 });
      clock.set(teamAClaudeCallTime.toJSDate());
      call(recorder, "ta-claude-1", "linear", "create_ticket", 4);

      const windsurf1CallTime = t0.plus({ seconds: 4 });
      clock.set(windsurf1CallTime.toJSDate());
      call(recorder, "ws-1", "github", "list_repos", 5);

      const windsurf2CallTime = t0.plus({ seconds: 5 });
      clock.set(windsurf2CallTime.toJSDate());
      call(recorder, "ws-2", "github", "list_repos", 1);

      const anonCallTime = t0.plus({ seconds: 6 });
      clock.set(anonCallTime.toJSDate());
      call(recorder, "anon-1", "slack", "post_message", 7);

      const clusters = recorder.export().connectedClientClusters;
      const teamA = clusters.find(
        (c) => c.identityType === "consumerTag" && c.consumerTag === "team-a",
      );
      const windsurf = clusters.find(
        (c) => c.identityType === "clientName" && c.clientName === "windsurf",
      );
      const anon = clusters.find((c) => c.identityType === "anonymous");

      // sum of 3 + 2 + 4
      expect(teamA?.usage.callCount).toBe(9);
      expect(teamA?.usage.lastCalledAt).toEqual(teamAClaudeCallTime.toJSDate());

      // sum of 5 + 1
      expect(windsurf?.usage.callCount).toBe(6);
      expect(windsurf?.usage.lastCalledAt).toEqual(
        windsurf2CallTime.toJSDate(),
      );

      // single session, 7 calls
      expect(anon?.usage.callCount).toBe(7);
      expect(anon?.usage.lastCalledAt).toEqual(anonCallTime.toJSDate());
    });

    it("→ a session with zero calls contributes nothing but still appears in the cluster", () => {
      const t0 = DateTime.fromISO("2026-05-01T10:00:00.000Z", { zone: "utc" });
      const clock = new ManualClock(t0.toJSDate());
      const recorder = new SystemStateTracker(clock, noOpLogger);
      setupServer(recorder, "github", ["create_issue"]);

      connect(recorder, "active", {
        consumerTag: "team-a",
        clientName: "cursor",
      });
      connect(recorder, "idle", {
        // This one never makes a call, but should still be in the cluster with the right clientName
        consumerTag: "team-a",
        clientName: "claude-ai",
      });

      const callTime = t0.plus({ seconds: 1 });
      clock.set(callTime.toJSDate());
      call(recorder, "active", "github", "create_issue", 4); // Make a call with `active` session, but not `idle`

      const clusters = recorder.export().connectedClientClusters;
      const teamA = clusters[0];
      if (teamA?.identityType !== "consumerTag") {
        throw new Error("expected consumerTag cluster");
      }
      expect(teamA.sessionIds).toEqual(["active", "idle"]);
      expect(teamA.clientNames).toEqual(["cursor", "claude-ai"]);
      expect(teamA.usage.callCount).toBe(4);
      expect(teamA.usage.lastCalledAt).toEqual(callTime.toJSDate());
    });
  });
});
