import { CloseSessionReason, SessionsManager } from "./sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { McpxSession } from "../model/sessions.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { ManualClock } from "@mcpx/toolkit-core/time";
import { ZodError } from "zod/v4";
import {
  DownstreamSessionStore,
  PersistedDownstreamSessionEntry,
} from "./downstream-session-store.js";

const noopSessionStore: DownstreamSessionStore = {
  store: async () => {},
  load: async () => undefined,
  delete: async () => {},
  list: async () => [],
};

const baseConfig = {
  pingIntervalMs: 1000,
  probeClientsGraceLivenessPeriodMs: 1000,
  sessionTtlMin: 60,
  pingMaxConsecutiveTimeouts: 3,
};

describe("SessionsManager", () => {
  let sessionsManager: SessionsManager;
  let systemState: SystemStateTracker;
  let clock: ManualClock;

  beforeEach(() => {
    clock = new ManualClock();
    systemState = new SystemStateTracker(clock, noOpLogger);
  });

  afterEach(async () => {
    await sessionsManager.shutdown();
  });

  it("should add a session", async () => {
    const sessionId = "test-session";
    sessionsManager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const session = createMockSession();

    await sessionsManager.addSession(sessionId, session);
    expect(sessionsManager.getSession(sessionId)).toBe(session);
  });

  it("getConsumerContext returns the sessionId for a known session", async () => {
    const sessionId = "identity-session";
    sessionsManager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    await sessionsManager.addSession(
      sessionId,
      createMockSession({ consumerTag: "team-a", clientName: "cursor" }),
    );

    const ctx = sessionsManager.getConsumerContext(sessionId);
    expect(ctx.sessionId).toBe(sessionId);
    expect(ctx.consumerTag).toBe("team-a");
    expect(ctx.clientName).toBe("cursor");
  });

  it("getConsumerContext returns an empty context for an unknown session", async () => {
    sessionsManager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    expect(sessionsManager.getConsumerContext("nope")).toEqual({});
    expect(sessionsManager.getConsumerContext(undefined)).toEqual({});
  });

  it("should close a session and cleanup resources", async () => {
    const sessionId = "test-session";
    sessionsManager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();
    const session = createMockSession();

    await sessionsManager.addSession(sessionId, session);

    expect(sessionsManager.getSession(sessionId)).toBeDefined();
    await sessionsManager.closeSession(
      sessionId,
      CloseSessionReason.TransportClosed,
    );
    expect(sessionsManager.getSession(sessionId)).toBeUndefined();
  });

  it("should garbage collect idle sessions", async () => {
    sessionsManager = new SessionsManager(
      {
        ...baseConfig,
        pingIntervalMs: 0,
        sessionTtlMin: 0.0001,
        sessionSweepIntervalMin: 0.0005,
      },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const sessionId = "test-session";
    const session = createMockSession();

    await sessionsManager.addSession(sessionId, session);

    clock.advanceBy(20);
    await waitFor(30);
    expect(sessionsManager.getSession(sessionId)).toBeUndefined();

    await sessionsManager.shutdown();
    sessionsManager = new SessionsManager(
      {
        ...baseConfig,
        pingIntervalMs: 0,
        sessionTtlMin: 0.0001,
        sessionSweepIntervalMin: 0.0005,
      },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const session2 = createMockSession();
    await sessionsManager.addSession(sessionId, session2);

    clock.advanceBy(20);
    await waitFor(30);

    expect(sessionsManager.getSession(sessionId)).toBeUndefined();
  });

  it("Touching a session prevents GC from terminating it", async () => {
    sessionsManager = new SessionsManager(
      {
        ...baseConfig,
        pingIntervalMs: 0,
        sessionTtlMin: 0.001,
        sessionSweepIntervalMin: 0.0005,
      },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();
    const sessionId = "active-session";
    const session = createMockSession();

    await sessionsManager.addSession(sessionId, session);

    clock.advanceBy(30);
    await waitFor(40);
    expect(sessionsManager.getSession(sessionId)).toBeDefined();

    sessionsManager.touchSession(sessionId);

    clock.advanceBy(30);
    await waitFor(40);
    expect(sessionsManager.getSession(sessionId)).toBeDefined();

    clock.advanceBy(61);
    await waitFor(40);
    expect(sessionsManager.getSession(sessionId)).toBeUndefined();
  });

  it("broadcasts tool list changes to all connected sessions", async () => {
    sessionsManager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const sentNotifications: string[] = [];
    const firstSession = createMockSession({
      onSendToolListChanged: async () => {
        sentNotifications.push("s1");
      },
    });
    const secondSession = createMockSession({
      onSendToolListChanged: async () => {
        sentNotifications.push("s2");
      },
    });

    await sessionsManager.addSession("s1", firstSession);
    await sessionsManager.addSession("s2", secondSession);
    await sessionsManager.broadcastListChanged("tools");

    expect(sentNotifications.sort()).toEqual(["s1", "s2"]);
  });

  it("continues broadcasting when a single session notification fails", async () => {
    sessionsManager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const failingSession = createMockSession({
      onSendToolListChanged: async () => {
        throw new Error("boom");
      },
    });
    const sentNotifications: string[] = [];
    const healthySession = createMockSession({
      onSendToolListChanged: async () => {
        sentNotifications.push("healthy");
      },
    });

    await sessionsManager.addSession("failing", failingSession);
    await sessionsManager.addSession("healthy", healthySession);

    await expect(sessionsManager.broadcastListChanged("tools")).resolves.toBe(
      undefined,
    );
    expect(sentNotifications).toEqual(["healthy"]);
  });

  it("closes a session after consecutive ping failures", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 3 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const sessionId = "failing-ping-session";
    const session = createMockSession({
      ping: async () => {
        throw new Error("ping failed");
      },
    });

    await sessionsManager.addSession(sessionId, session);

    await waitFor(120);

    expect(sessionsManager.getSession(sessionId)).toBeUndefined();
  });

  it("closes a session after consecutive ping timeouts", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 3 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const sessionId = "timing-out-session";
    // The SDK raises McpError(RequestTimeout) when a ping exceeds its timeout.
    const session = createMockSession({
      ping: async () => {
        throw new McpError(ErrorCode.RequestTimeout, "Request timed out");
      },
    });

    await sessionsManager.addSession(sessionId, session);

    await waitFor(120);

    expect(sessionsManager.getSession(sessionId)).toBeUndefined();
  });

  it("keeps a session open when the client does not support ping", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 3 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const sessionId = "no-ping-session";
    const session = createMockSession({
      ping: async () => {
        throw new McpError(ErrorCode.MethodNotFound, "Method not found: ping");
      },
    });

    await sessionsManager.addSession(sessionId, session);

    await waitFor(120);

    expect(sessionsManager.getSession(sessionId)).toBeDefined();
    expect(sessionsManager.getSessionLiveness(sessionId)?.unresponsive).toBe(
      false,
    );
  });

  it("stops pinging once the session is closed (no leaked ping loop)", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 1000 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    let pingCount = 0;
    const sessionId = "closed-session";
    const session = createMockSession({
      ping: async () => {
        pingCount += 1;
      },
    });

    await sessionsManager.addSession(sessionId, session);
    await waitFor(45);
    expect(pingCount).toBeGreaterThan(0);

    await sessionsManager.closeSession(
      sessionId,
      CloseSessionReason.TransportClosed,
    );
    const countAtClose = pingCount;

    await waitFor(45);
    expect(pingCount).toBe(countAtClose);
  });

  it("stops pinging every session on shutdown", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 1000 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    let pingCount = 0;
    const session = createMockSession({
      ping: async () => {
        pingCount += 1;
      },
    });
    await sessionsManager.addSession("shutdown-session", session);
    await waitFor(45);
    expect(pingCount).toBeGreaterThan(0);

    await sessionsManager.shutdown();
    const countAtShutdown = pingCount;

    await waitFor(45);
    expect(pingCount).toBe(countAtShutdown);
  });

  it("clears a probe session's termination timer on shutdown", async () => {
    sessionsManager = new SessionsManager(
      {
        ...baseConfig,
        pingIntervalMs: 0,
        probeClientsGraceLivenessPeriodMs: 40,
      },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const probe = createMockSession();
    probe.metadata.isProbe = true;
    await sessionsManager.addSession("probe-1", probe);

    const closeSpy = jest.spyOn(sessionsManager, "closeSession");
    await sessionsManager.shutdown();
    closeSpy.mockClear();

    // If the probe timer were left running, it would fire here and close it.
    await waitFor(80);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("flags a session unresponsive on a missed ping and clears it on recovery", async () => {
    let pingShouldFail = true;
    sessionsManager = new SessionsManager(
      // High threshold so it survives long enough to observe flip + recovery.
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 1000 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const sessionId = "flaky-session";
    const session = createMockSession({
      ping: async () => {
        if (pingShouldFail) {
          throw new Error("ping failed");
        }
      },
    });

    await sessionsManager.addSession(sessionId, session);

    await waitFor(60);
    expect(sessionsManager.getSessionLiveness(sessionId)?.unresponsive).toBe(
      true,
    );

    pingShouldFail = false;
    await waitFor(60);
    expect(sessionsManager.getSessionLiveness(sessionId)?.unresponsive).toBe(
      false,
    );
  });

  it("markSessionUnresponsive flips state via the liveness path, cleared by activity", async () => {
    sessionsManager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();
    await sessionsManager.addSession(
      "s",
      createMockSession({ clientName: "cursor" }),
    );

    sessionsManager.markSessionUnresponsive("s");
    expect(sessionsManager.getSessionLiveness("s")?.unresponsive).toBe(true);
    expect(
      systemState.export().connectedClients.find((c) => c.sessionId === "s")
        ?.connectionState,
    ).toBe("unresponsive");

    // Inbound activity restores it through the same path.
    sessionsManager.touchSession("s");
    expect(sessionsManager.getSessionLiveness("s")?.unresponsive).toBe(false);
    expect(
      systemState.export().connectedClients.find((c) => c.sessionId === "s")
        ?.connectionState,
    ).toBe("connected");
  });

  it("does not reap an actively-touched session even when pings fail", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 2 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const sessionId = "active-no-getstream";
    // Pings always fail (no receiver), so inbound touches must keep it alive.
    const session = createMockSession({
      ping: async () => {
        throw new Error("no receiver for server-initiated ping");
      },
    });
    await sessionsManager.addSession(sessionId, session);

    const touch = setInterval(() => sessionsManager.touchSession(sessionId), 4);
    await waitFor(120);
    expect(sessionsManager.getSession(sessionId)).toBeDefined();
    clearInterval(touch);
  });

  it("keeps a session open when the ping result has an invalid shape", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 2 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const sessionId = "invalid-ping-result";
    // A wrong-shape ping result surfaces as a ZodError: unsupported, not a miss.
    const session = createMockSession({
      ping: async () => {
        throw new ZodError([]);
      },
    });
    await sessionsManager.addSession(sessionId, session);

    await waitFor(120);
    expect(sessionsManager.getSession(sessionId)).toBeDefined();
  });

  it("does not ping-reap a streamable client without ping support", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 2 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    let pingCalls = 0;
    // No advertised ping support and no channel: must not be pinged or reaped.
    const session = createMockSession({
      transportType: "streamableHttp",
      ping: async () => {
        pingCalls += 1;
        throw new Error("no channel");
      },
    });
    await sessionsManager.addSession("no-ping-streamable", session);

    await waitFor(80);
    expect(sessionsManager.getSession("no-ping-streamable")).toBeDefined();
    expect(pingCalls).toBe(0);
  });

  it("ping-reaps a streamable client that advertises ping support", async () => {
    sessionsManager = new SessionsManager(
      { ...baseConfig, pingIntervalMs: 10, pingMaxConsecutiveTimeouts: 2 },
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await sessionsManager.initialize();

    const session = createMockSession({
      transportType: "streamableHttp",
      pingSupported: true,
      ping: async () => {
        throw new Error("client gone");
      },
    });
    await sessionsManager.addSession("ping-streamable", session);

    await waitFor(120);
    expect(sessionsManager.getSession("ping-streamable")).toBeUndefined();
  });
});

describe("SessionsManager.loadPersistedDownstreamSession", () => {
  it("returns data when the store has the session", async () => {
    const stored = {
      metadata: { clientId: "c1", isProbe: false, clientInfo: {} },
    };
    const sessionStore: DownstreamSessionStore = {
      store: async () => {},
      load: async () => stored,
      delete: async () => {},
      list: async () => [],
    };
    const manager = new SessionsManager(
      baseConfig,
      new SystemStateTracker(new ManualClock(), noOpLogger),
      noOpLogger,
      new ManualClock(),
      sessionStore,
    );
    await manager.initialize();

    const result = await manager.loadPersistedDownstreamSession("s1");

    expect(result).toBe(stored);
    await manager.shutdown();
  });

  it("returns undefined when the store has no session", async () => {
    const manager = new SessionsManager(
      baseConfig,
      new SystemStateTracker(new ManualClock(), noOpLogger),
      noOpLogger,
      new ManualClock(),
      noopSessionStore,
    );
    await manager.initialize();

    const result = await manager.loadPersistedDownstreamSession("s1");

    expect(result).toBeUndefined();
    await manager.shutdown();
  });

  it("returns undefined and does not throw when the store rejects", async () => {
    const sessionStore: DownstreamSessionStore = {
      store: async () => {},
      load: async () => {
        throw new Error("Redis down");
      },
      delete: async () => {},
      list: async () => [],
    };
    const manager = new SessionsManager(
      baseConfig,
      new SystemStateTracker(new ManualClock(), noOpLogger),
      noOpLogger,
      new ManualClock(),
      sessionStore,
    );
    await manager.initialize();

    const result = await manager.loadPersistedDownstreamSession("s1");

    expect(result).toBeUndefined();
    await manager.shutdown();
  });
});

describe("SessionsManager recovery", () => {
  it("surfaces a persisted session as disconnected at startup and flips it to connected when its id restores", async () => {
    const clock = new ManualClock();
    const systemState = new SystemStateTracker(clock, noOpLogger);
    const persisted: PersistedDownstreamSessionEntry[] = [
      {
        sessionId: "restored-session",
        data: {
          metadata: {
            clientId: "agent-1",
            consumerTag: "team-a",
            isProbe: false,
            clientInfo: { name: "cursor" },
          },
        },
      },
    ];
    const sessionStore: DownstreamSessionStore = {
      store: async () => {},
      load: async () => undefined,
      delete: async () => {},
      list: async () => persisted,
    };
    const manager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      sessionStore,
    );

    await manager.initialize();
    await manager.loadDisconnectedSessions();

    const offline = systemState
      .export()
      .connectedClients.find((c) => c.sessionId === "restored-session");
    expect(offline?.connectionState).toBe("disconnected");
    expect(offline?.disconnectedAt).toBeDefined();

    // Same-id restore: the client resends its session id.
    await manager.addSession(
      "restored-session",
      createMockSession({ clientName: "cursor" }),
    );

    const online = systemState
      .export()
      .connectedClients.find((c) => c.sessionId === "restored-session");
    expect(online?.connectionState).toBe("connected");
    expect(online?.disconnectedAt).toBeUndefined();

    await manager.shutdown();
  });

  it("prunes disconnected records after the retention window", async () => {
    const clock = new ManualClock();
    const systemState = new SystemStateTracker(clock, noOpLogger, {
      disconnectedRetentionMs: 1000,
    });
    const sessionStore: DownstreamSessionStore = {
      store: async () => {},
      load: async () => undefined,
      delete: async () => {},
      list: async () => [
        {
          sessionId: "old-session",
          data: {
            metadata: { clientId: "agent-1", isProbe: false, clientInfo: {} },
          },
        },
      ],
    };
    const manager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      sessionStore,
    );

    await manager.initialize();
    await manager.loadDisconnectedSessions();
    expect(
      systemState
        .export()
        .connectedClients.some((c) => c.sessionId === "old-session"),
    ).toBe(true);

    clock.advanceBy(2000);
    expect(
      systemState
        .export()
        .connectedClients.some((c) => c.sessionId === "old-session"),
    ).toBe(false);

    await manager.shutdown();
  });

  it("loads only once, so a Hub reconnect does not re-surface aged-out records", async () => {
    const clock = new ManualClock();
    const systemState = new SystemStateTracker(clock, noOpLogger);
    let listCalls = 0;
    const sessionStore: DownstreamSessionStore = {
      store: async () => {},
      load: async () => undefined,
      delete: async () => {},
      list: async () => {
        listCalls += 1;
        return [
          {
            sessionId: "s1",
            data: {
              metadata: { clientId: "agent-1", isProbe: false, clientInfo: {} },
            },
          },
        ];
      },
    };
    const manager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      sessionStore,
    );
    await manager.initialize();

    await manager.loadDisconnectedSessions();
    await manager.loadDisconnectedSessions();

    expect(listCalls).toBe(1);
    await manager.shutdown();
  });

  it("keeps a runtime disconnect visible as offline until the retention window", async () => {
    const clock = new ManualClock();
    const systemState = new SystemStateTracker(clock, noOpLogger, {
      disconnectedRetentionMs: 1000,
    });
    const manager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      noopSessionStore,
    );
    await manager.initialize();
    await manager.addSession("s1", createMockSession({ clientName: "cursor" }));

    await manager.closeSession("s1", CloseSessionReason.TransportClosed);

    const offline = systemState
      .export()
      .connectedClients.find((c) => c.sessionId === "s1");
    expect(offline?.connectionState).toBe("disconnected");
    expect(offline?.disconnectedAt).toBeDefined();
    expect(manager.getSession("s1")).toBeUndefined();

    clock.advanceBy(2000);
    expect(
      systemState.export().connectedClients.some((c) => c.sessionId === "s1"),
    ).toBe(false);

    await manager.shutdown();
  });

  it("does not latch when the first list fails, so it retries on reconnect", async () => {
    const clock = new ManualClock();
    const systemState = new SystemStateTracker(clock, noOpLogger);
    let listCalls = 0;
    const sessionStore: DownstreamSessionStore = {
      store: async () => {},
      load: async () => undefined,
      delete: async () => {},
      list: async () => {
        listCalls += 1;
        if (listCalls === 1) {
          throw new Error("hub not ready");
        }
        return [
          {
            sessionId: "s1",
            data: {
              metadata: { clientId: "agent-1", isProbe: false, clientInfo: {} },
            },
          },
        ];
      },
    };
    const manager = new SessionsManager(
      baseConfig,
      systemState,
      noOpLogger,
      clock,
      sessionStore,
    );
    await manager.initialize();

    await manager.loadDisconnectedSessions(); // fails, must not latch
    expect(
      systemState.export().connectedClients.some((c) => c.sessionId === "s1"),
    ).toBe(false);

    await manager.loadDisconnectedSessions(); // retry succeeds
    expect(listCalls).toBe(2);
    expect(
      systemState.export().connectedClients.some((c) => c.sessionId === "s1"),
    ).toBe(true);

    await manager.shutdown();
  });

  it("sweep prunes an expired offline agent and notifies subscribers", async () => {
    const clock = new ManualClock();
    const systemState = new SystemStateTracker(clock, noOpLogger, {
      disconnectedRetentionMs: 50,
    });
    systemState.recordDisconnectedClient({
      sessionId: "old",
      client: { clientId: "agent-1" },
      disconnectedAt: clock.now().getTime(),
    });
    const snapshots: ReturnType<typeof systemState.export>[] = [];
    systemState.subscribe((s) => snapshots.push(s));

    systemState.startRetentionSweep(10);
    clock.advanceBy(100);
    await waitFor(40);
    systemState.stopRetentionSweep();

    const last = snapshots[snapshots.length - 1];
    expect(last?.connectedClients.some((c) => c.sessionId === "old")).toBe(
      false,
    );
    expect(snapshots.length).toBeGreaterThan(1);
  });
});

function createMockSession(overrides?: {
  onSendToolListChanged?: () => Promise<void>;
  ping?: () => Promise<void>;
  consumerTag?: string;
  clientName?: string;
  transportType?: "sse" | "streamableHttp";
  pingSupported?: boolean;
}): McpxSession {
  // Route the test ping through server.request(), which liveness calls.
  const pingImpl = overrides?.ping ?? (async () => {});
  const mockServer = {
    close: async () => {},
    request: async () => {
      await pingImpl();
      return {};
    },
    sendToolListChanged: overrides?.onSendToolListChanged ?? (async () => {}),
  } as unknown as Server;
  const mockTransport = {
    close: async () => {},
  } as unknown as Transport;
  const adapter =
    overrides?.pingSupported === undefined
      ? undefined
      : {
          name: "mcp-remote" as const,
          support: { ping: overrides.pingSupported },
        };
  const clientInfo = {
    ...(overrides?.clientName ? { name: overrides.clientName } : {}),
    ...(adapter ? { adapter } : {}),
  };
  const session: McpxSession = {
    transport: {
      type: overrides?.transportType ?? "sse",
      transport: mockTransport,
    } as unknown as McpxSession["transport"],
    consumerConfig: undefined,
    metadata: {
      clientId: "test-client",
      isProbe: false,
      consumerTag: overrides?.consumerTag,
      clientInfo,
    },
    server: mockServer,
  };
  return session;
}

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
