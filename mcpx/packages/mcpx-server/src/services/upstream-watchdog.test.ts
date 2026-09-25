import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { UpstreamWatchdog } from "./upstream-watchdog.js";

const INTERVAL_MS = 10;
const config = {
  pingIntervalMs: INTERVAL_MS,
  pingTimeoutMs: 500,
  pingFailureThreshold: 1,
};

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

  it("tolerates ping failures below the threshold", async () => {
    let pingCallCount = 0;
    let unreachableCalled = false;

    const watchdog = new UpstreamWatchdog(
      {
        pingServer: async () => {
          pingCallCount++;
          return pingCallCount < 3 ? new Error("slow") : null;
        },
        onServerUnreachable: async () => {
          unreachableCalled = true;
        },
      },
      { ...config, pingFailureThreshold: 3 },
      noOpLogger,
    );

    watchdog.watch("server-a");
    await waitFor(INTERVAL_MS * 6);
    watchdog.unwatch("server-a");

    expect(pingCallCount).toBeGreaterThanOrEqual(3);
    expect(unreachableCalled).toBe(false);
  });

  it("only reports unreachable after consecutive failures reach the threshold", async () => {
    const outcomes: Array<Error | null> = [
      new Error("1"),
      null,
      new Error("2"),
      new Error("3"),
    ];
    let pingCallCount = 0;
    const unreachableCalls: Error[] = [];

    const watchdog = new UpstreamWatchdog(
      {
        pingServer: async () => {
          const outcome =
            pingCallCount < outcomes.length
              ? outcomes[pingCallCount]!
              : new Error("late");
          pingCallCount++;
          return outcome;
        },
        onServerUnreachable: async (_name, error) => {
          unreachableCalls.push(error);
        },
      },
      { ...config, pingFailureThreshold: 2 },
      noOpLogger,
    );

    watchdog.watch("server-a");
    await waitFor(INTERVAL_MS * 8);

    expect(pingCallCount).toBe(4);
    expect(unreachableCalls.map((e) => e.message)).toEqual(["3"]);
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
      { pingIntervalMs: 0, pingTimeoutMs: 500, pingFailureThreshold: 1 },
      noOpLogger,
    );

    watchdog.watch("server-a");
    await waitFor(INTERVAL_MS * 5);

    expect(pingCallCount).toBe(0);
  });

  describe("reported call outcomes", () => {
    const noPing = { ...config, pingIntervalMs: 0 };

    function watchdogCollecting(
      unreachableCalls: Error[],
      pingFailureThreshold: number,
    ): UpstreamWatchdog {
      return new UpstreamWatchdog(
        {
          pingServer: async () => null,
          onServerUnreachable: async (_name, error) => {
            unreachableCalls.push(error);
          },
        },
        { ...noPing, pingFailureThreshold },
        noOpLogger,
      );
    }

    it("counts reported failures toward the threshold even without pings", () => {
      const unreachableCalls: Error[] = [];
      const watchdog = watchdogCollecting(unreachableCalls, 3);

      watchdog.watch("server-a");
      watchdog.reportFailure("server-a", new Error("1"));
      watchdog.reportFailure("server-a", new Error("2"));
      expect(unreachableCalls).toHaveLength(0);

      watchdog.reportFailure("server-a", new Error("3"));
      expect(unreachableCalls.map((e) => e.message)).toEqual(["3"]);
    });

    it("resets the counter on a reported success", () => {
      const unreachableCalls: Error[] = [];
      const watchdog = watchdogCollecting(unreachableCalls, 2);

      watchdog.watch("server-a");
      watchdog.reportFailure("server-a", new Error("1"));
      watchdog.reportSuccess("server-a");
      watchdog.reportFailure("server-a", new Error("2"));
      expect(unreachableCalls).toHaveLength(0);

      watchdog.reportFailure("server-a", new Error("3"));
      expect(unreachableCalls.map((e) => e.message)).toEqual(["3"]);
    });

    it("reports unreachable once when failures race past the threshold", () => {
      const unreachableCalls: Error[] = [];
      const watchdog = watchdogCollecting(unreachableCalls, 1);

      watchdog.watch("server-a");
      watchdog.reportFailure("server-a", new Error("1"));
      watchdog.reportFailure("server-a", new Error("2"));
      expect(unreachableCalls.map((e) => e.message)).toEqual(["1"]);
    });

    it("ignores reports for servers that are not watched", () => {
      const unreachableCalls: Error[] = [];
      const watchdog = watchdogCollecting(unreachableCalls, 1);

      watchdog.reportFailure("server-a", new Error("orphan"));
      watchdog.watch("server-a");
      watchdog.unwatch("server-a");
      watchdog.reportFailure("server-a", new Error("late"));
      expect(unreachableCalls).toHaveLength(0);
    });

    it("reaches the threshold from reported failures when pings give no signal", async () => {
      const unreachableCalls: Error[] = [];
      const watchdog = new UpstreamWatchdog(
        {
          // What isAlive returns for a server that does not support ping.
          pingServer: async () => "no-signal" as const,
          onServerUnreachable: async (_name, error) => {
            unreachableCalls.push(error);
          },
        },
        { ...config, pingFailureThreshold: 3 },
        noOpLogger,
      );

      watchdog.watch("server-a");
      watchdog.reportFailure("server-a", new Error("1"));
      await waitFor(INTERVAL_MS * 2);
      watchdog.reportFailure("server-a", new Error("2"));
      await waitFor(INTERVAL_MS * 2);
      watchdog.reportFailure("server-a", new Error("3"));
      watchdog.unwatch("server-a");

      expect(unreachableCalls.map((e) => e.message)).toEqual(["3"]);
    });

    it("shares the counter between pings and reported failures", async () => {
      let pingCallCount = 0;
      const unreachableCalls: Error[] = [];
      const watchdog = new UpstreamWatchdog(
        {
          pingServer: async () => {
            pingCallCount++;
            return new Error("ping");
          },
          onServerUnreachable: async (_name, error) => {
            unreachableCalls.push(error);
          },
        },
        { ...config, pingFailureThreshold: 2 },
        noOpLogger,
      );

      watchdog.watch("server-a");
      watchdog.reportFailure("server-a", new Error("call"));
      await waitFor(INTERVAL_MS * 3);

      expect(pingCallCount).toBe(1);
      expect(unreachableCalls.map((e) => e.message)).toEqual(["ping"]);
    });
  });
});
