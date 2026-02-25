import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { deriveMetrics } from "./useMetricsCache";
import {
  getMetricsStore,
  STORAGE_KEY,
  MAX_AGE_MS,
  MetricSnapshot,
} from "@/store/metrics";
import { Agent, McpServer } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    timestamp: Date.now(),
    tools: 5,
    servers: 2,
    agents: 1,
    totalRequests: 42,
    ...overrides,
  };
}

function makeServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: "server-test",
    name: "test",
    status: "connected_stopped",
    tools: [],
    args: [],
    command: "",
    env: {},
    configuration: {},
    type: "stdio",
    url: "",
    headers: {},
    ...overrides,
  } as McpServer;
}

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    identifier: "test-agent",
    status: "connected",
    lastActivity: new Date(),
    sessionIds: ["s1"],
    llm: { provider: "openai", model: "gpt-4" },
    usage: { callCount: 0 },
    ...overrides,
  } as Agent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMetricsCache utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the store to initial state between tests
    getMetricsStore().setState({ snapshots: [] });
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Zustand store with persist ─────────────────────────────────────────

  describe("metrics store", () => {
    it("starts with empty snapshots", () => {
      expect(getMetricsStore().getState().snapshots).toEqual([]);
    });

    it("addSnapshot appends to snapshots", () => {
      const store = getMetricsStore();
      const snap = makeSnapshot();
      store.getState().addSnapshot(snap);

      expect(store.getState().snapshots).toHaveLength(1);
      expect(store.getState().snapshots[0].tools).toBe(snap.tools);
    });

    it("addSnapshot prunes entries older than MAX_AGE_MS", () => {
      const store = getMetricsStore();
      const old = makeSnapshot({ timestamp: Date.now() - MAX_AGE_MS - 1000 });
      // Seed directly to simulate old data
      store.setState({ snapshots: [old] });

      const fresh = makeSnapshot({ timestamp: Date.now() });
      store.getState().addSnapshot(fresh);

      expect(store.getState().snapshots).toHaveLength(1);
      expect(store.getState().snapshots[0].timestamp).toBe(fresh.timestamp);
    });

    it("clearCache resets snapshots to empty", () => {
      const store = getMetricsStore();
      store.getState().addSnapshot(makeSnapshot());
      expect(store.getState().snapshots).toHaveLength(1);

      store.getState().clearCache();
      expect(store.getState().snapshots).toEqual([]);
    });

    it("persists snapshots to localStorage", () => {
      const store = getMetricsStore();
      const snap = makeSnapshot();
      store.getState().addSnapshot(snap);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.state.snapshots).toHaveLength(1);
      expect(stored.state.snapshots[0].tools).toBe(snap.tools);
    });

    it("clearCache removes data from localStorage", () => {
      const store = getMetricsStore();
      store.getState().addSnapshot(makeSnapshot());
      store.getState().clearCache();

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.state.snapshots).toEqual([]);
    });

    it("handles localStorage quota errors gracefully on addSnapshot", () => {
      const spy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("QuotaExceededError");
        });

      const store = getMetricsStore();
      // Should not throw — persist middleware catches storage errors
      expect(() =>
        store.getState().addSnapshot(makeSnapshot()),
      ).not.toThrow();

      // In-memory state still updated even if storage fails
      expect(store.getState().snapshots).toHaveLength(1);

      spy.mockRestore();
    });
  });

  // ── deriveMetrics ──────────────────────────────────────────────────────

  describe("deriveMetrics", () => {
    it("counts connected servers (running + stopped)", () => {
      const servers = [
        makeServer({ status: "connected_running" }),
        makeServer({ status: "connected_stopped" }),
        makeServer({ status: "connection_failed" }),
      ];

      const result = deriveMetrics([], servers, "0/3");
      expect(result.servers).toBe(2);
    });

    it("counts active agents (connected + recently active)", () => {
      const activeAgent = makeAgent({
        status: "connected",
        lastActivity: new Date(), // just now — isActive = true
      });
      const staleAgent = makeAgent({
        id: "agent-2",
        status: "connected",
        lastActivity: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago — isActive = false
      });

      const result = deriveMetrics([activeAgent, staleAgent], [], "0/0");
      expect(result.agents).toBe(1);
    });

    it("extracts tools count from the left side of toolsValue", () => {
      const result = deriveMetrics([], [], "12/20");
      expect(result.tools).toBe(12);
    });

    it("falls back to 0 for malformed toolsValue", () => {
      expect(deriveMetrics([], [], "abc/20").tools).toBe(0);
      expect(deriveMetrics([], [], "").tools).toBe(0);
    });

    it("uses systemUsage.callCount for totalRequests", () => {
      const result = deriveMetrics([], [], "0/0", { callCount: 99 });
      expect(result.totalRequests).toBe(99);
    });

    it("defaults totalRequests to 0 when systemUsage is undefined", () => {
      const result = deriveMetrics([], [], "0/0");
      expect(result.totalRequests).toBe(0);
    });
  });

  // ── Integration ────────────────────────────────────────────────────────

  describe("store integration", () => {
    it("accumulates multiple samples without losing data", () => {
      const store = getMetricsStore();

      store.getState().addSnapshot(makeSnapshot({ timestamp: Date.now() - 10000, tools: 1 }));
      store.getState().addSnapshot(makeSnapshot({ timestamp: Date.now(), tools: 2 }));

      const { snapshots } = store.getState();
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].tools).toBe(1);
      expect(snapshots[1].tools).toBe(2);
    });

    it("pruning only removes entries older than MAX_AGE_MS", () => {
      vi.useFakeTimers();
      const now = Date.now();
      const store = getMetricsStore();

      store.setState({
        snapshots: [
          makeSnapshot({ timestamp: now - MAX_AGE_MS - 1000 }),
          makeSnapshot({ timestamp: now - 1000 }),
        ],
      });

      // Adding a new snapshot triggers pruning
      store.getState().addSnapshot(makeSnapshot({ timestamp: now }));

      const { snapshots } = store.getState();
      expect(snapshots).toHaveLength(2); // the old one pruned, the -1000 and now remain
      expect(snapshots[0].timestamp).toBe(now - 1000);
      expect(snapshots[1].timestamp).toBe(now);

      vi.useRealTimers();
    });
  });
});
