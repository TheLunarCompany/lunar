import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { UpstreamWatchdog } from "./upstream-watchdog.js";

const INTERVAL_MS = 10;
const config = { pingIntervalMs: INTERVAL_MS, pingTimeoutMs: 500 };

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("UpstreamWatchdog", () => {
  it("calls onServerUnreachable when ping returns an error", async () => {
    const pingError = new Error("connection refused");
    let pingCallCount = 0;
    const unreachableCalls: Array<{ name: string; error: Error }> = [];

    const watchdog = new UpstreamWatchdog(
      {
        pingServer: async () => {
          pingCallCount++;
          return pingError;
        },
        onServerUnreachable: async (name, error) => {
          unreachableCalls.push({ name, error });
        },
      },
      config,
      noOpLogger,
    );

    watchdog.watch("server-a");
    await waitFor(INTERVAL_MS * 3);
    watchdog.unwatch("server-a");

    expect(pingCallCount).toBe(1);
    expect(unreachableCalls).toHaveLength(1);
    expect(unreachableCalls[0]).toEqual({ name: "server-a", error: pingError });
  });

  it("does not call onServerUnreachable when ping returns null", async () => {
    let pingCallCount = 0;
    let unreachableCalled = false;

    const watchdog = new UpstreamWatchdog(
      {
        pingServer: async () => {
          pingCallCount++;
          return null;
        },
        onServerUnreachable: async () => {
          unreachableCalled = true;
        },
      },
      config,
      noOpLogger,
    );

    watchdog.watch("server-a");
    await waitFor(INTERVAL_MS * 5);
    watchdog.unwatch("server-a");

    expect(pingCallCount).toBeGreaterThanOrEqual(3);
    expect(unreachableCalled).toBe(false);
  });

  it("stops pinging after the first failure", async () => {
    let pingCallCount = 0;

    const watchdog = new UpstreamWatchdog(
      {
        pingServer: async () => {
          pingCallCount++;
          return new Error("dead");
        },
        onServerUnreachable: async () => {},
      },
      config,
      noOpLogger,
    );

    watchdog.watch("server-a");
    await waitFor(INTERVAL_MS * 5);

    expect(pingCallCount).toBe(1);
  });

  it("stops pinging after unwatch", async () => {
    let pingCallCount = 0;

    const watchdog = new UpstreamWatchdog(
      {
        pingServer: async () => {
          pingCallCount++;
          return null;
        },
        onServerUnreachable: async () => {},
      },
      config,
      noOpLogger,
    );

    watchdog.watch("server-a");
    await waitFor(INTERVAL_MS * 2);
    watchdog.unwatch("server-a");
    const countAfterUnwatch = pingCallCount;
    await waitFor(INTERVAL_MS * 3);

    expect(pingCallCount).toBe(countAfterUnwatch);
  });

  it("does not start ping when pingIntervalMs is 0", async () => {
    let pingCallCount = 0;

    const watchdog = new UpstreamWatchdog(
      {
        pingServer: async () => {
          pingCallCount++;
          return null;
        },
        onServerUnreachable: async () => {},
      },
      { pingIntervalMs: 0, pingTimeoutMs: 500 },
      noOpLogger,
    );

    watchdog.watch("server-a");
    await waitFor(INTERVAL_MS * 5);

    expect(pingCallCount).toBe(0);
  });
});
