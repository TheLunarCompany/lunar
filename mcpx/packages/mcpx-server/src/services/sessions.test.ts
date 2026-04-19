import { CloseSessionReason, SessionsManager } from "./sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { McpxSession } from "../model/sessions.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { ManualClock } from "@mcpx/toolkit-core/time";

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
      {
        pingIntervalMs: 1000,
        probeClientsGraceLivenessPeriodMs: 1000,
        sessionTtlMin: 60,
      },
      systemState,
      noOpLogger,
      clock,
    );
    await sessionsManager.initialize();

    const session = createMockSession();

    await sessionsManager.addSession(sessionId, session);
    expect(sessionsManager.getSession(sessionId)).toBe(session);
  });

  it("should close a session and cleanup resources", async () => {
    const sessionId = "test-session";
    sessionsManager = new SessionsManager(
      {
        pingIntervalMs: 1000,
        probeClientsGraceLivenessPeriodMs: 1000,
        sessionTtlMin: 60,
      },
      systemState,
      noOpLogger,
      clock,
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
        pingIntervalMs: 0,
        probeClientsGraceLivenessPeriodMs: 1000,
        sessionTtlMin: 0.0001,
        sessionSweepIntervalMin: 0.0005,
      },
      systemState,
      noOpLogger,
      clock,
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
        pingIntervalMs: 0,
        probeClientsGraceLivenessPeriodMs: 1000,
        sessionTtlMin: 0.0001,
        sessionSweepIntervalMin: 0.0005,
      },
      systemState,
      noOpLogger,
      clock,
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
        pingIntervalMs: 0,
        probeClientsGraceLivenessPeriodMs: 1000,
        sessionTtlMin: 0.001,
        sessionSweepIntervalMin: 0.0005,
      },
      systemState,
      noOpLogger,
      clock,
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
      {
        pingIntervalMs: 1000,
        probeClientsGraceLivenessPeriodMs: 1000,
        sessionTtlMin: 60,
      },
      systemState,
      noOpLogger,
      clock,
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
    await sessionsManager.broadcastToolListChanged();

    expect(sentNotifications.sort()).toEqual(["s1", "s2"]);
  });

  it("continues broadcasting when a single session notification fails", async () => {
    sessionsManager = new SessionsManager(
      {
        pingIntervalMs: 1000,
        probeClientsGraceLivenessPeriodMs: 1000,
        sessionTtlMin: 60,
      },
      systemState,
      noOpLogger,
      clock,
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

    await expect(sessionsManager.broadcastToolListChanged()).resolves.toBe(
      undefined,
    );
    expect(sentNotifications).toEqual(["healthy"]);
  });
});

function createMockSession(overrides?: {
  onSendToolListChanged?: () => Promise<void>;
}): McpxSession {
  const mockServer = {
    close: async () => {},
    ping: async () => {},
    sendToolListChanged: overrides?.onSendToolListChanged ?? (async () => {}),
  } as unknown as Server;
  const mockTransport = {
    close: async () => {},
  } as unknown as Transport;
  const session: McpxSession = {
    transport: {
      type: "sse",
      transport: mockTransport,
    } as unknown as McpxSession["transport"],
    consumerConfig: undefined,
    metadata: {
      clientId: "test-client",
      isProbe: false,
      clientInfo: {},
    },
    server: mockServer,
  };
  return session;
}

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
