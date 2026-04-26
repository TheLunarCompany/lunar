import { describe, it, expect } from "@jest/globals";
import {
  withAsyncPolling,
  withPolling,
  PollingExhaustedError,
  PollingAbortedError,
} from "./polling.js";

describe("withAsyncPolling", () => {
  describe("successful resolution", () => {
    it("returns value when found predicate matches", async () => {
      let callCount = 0;
      const result = await withAsyncPolling({
        maxAttempts: 5,
        sleepTimeMs: 1,
        getValue: async (): Promise<string | undefined> => {
          callCount++;
          return callCount >= 3 ? "found" : undefined;
        },
        found: (value): value is string => value === "found",
      });

      expect(result).toBe("found");
      expect(callCount).toBe(3);
    });

    it("returns immediately if first value matches", async () => {
      let callCount = 0;
      const result = await withAsyncPolling({
        maxAttempts: 5,
        sleepTimeMs: 1,
        getValue: async () => {
          callCount++;
          return 42;
        },
        found: (value): value is number => value === 42,
      });

      expect(result).toBe(42);
      expect(callCount).toBe(1);
    });
  });

  describe("exhausted behavior", () => {
    it("throws PollingExhaustedError when max attempts reached", async () => {
      let callCount = 0;
      await expect(
        withAsyncPolling({
          maxAttempts: 3,
          sleepTimeMs: 1,
          getValue: async (): Promise<string | undefined> => {
            callCount++;
            return undefined;
          },
          found: (value): value is string => value !== undefined,
        }),
      ).rejects.toThrow(PollingExhaustedError);

      expect(callCount).toBe(3);
    });

    it("PollingExhaustedError has correct name", () => {
      const error = new PollingExhaustedError();
      expect(error.name).toBe("PollingExhaustedError");
      expect(error.message).toBe("Polling exhausted");
    });
  });

  describe("abort behavior", () => {
    it("throws PollingAbortedError when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        withAsyncPolling({
          maxAttempts: 5,
          sleepTimeMs: 1,
          getValue: async (): Promise<string | undefined> => undefined,
          found: (value): value is string => value !== undefined,
          signal: controller.signal,
        }),
      ).rejects.toThrow(PollingAbortedError);
    });

    it("throws PollingAbortedError when signal aborts during polling", async () => {
      const controller = new AbortController();
      let callCount = 0;

      const promise = withAsyncPolling({
        maxAttempts: 100,
        sleepTimeMs: 10,
        getValue: async (): Promise<string | undefined> => {
          callCount++;
          if (callCount === 2) {
            controller.abort();
          }
          return undefined;
        },
        found: (value): value is string => value !== undefined,
        signal: controller.signal,
      });

      await expect(promise).rejects.toThrow(PollingAbortedError);
      expect(callCount).toBeLessThan(100);
    });

    it("PollingAbortedError has correct name", () => {
      const error = new PollingAbortedError();
      expect(error.name).toBe("PollingAbortedError");
      expect(error.message).toBe("Polling aborted");
    });

    it("does not throw if signal is provided but never aborted", async () => {
      const controller = new AbortController();
      let callCount = 0;

      const result = await withAsyncPolling({
        maxAttempts: 5,
        sleepTimeMs: 1,
        getValue: async (): Promise<string | undefined> => {
          callCount++;
          return callCount >= 3 ? "found" : undefined;
        },
        found: (value): value is string => value === "found",
        signal: controller.signal,
      });

      expect(result).toBe("found");
    });
  });
});

describe("withPolling", () => {
  it("works with synchronous getValue function", async () => {
    let callCount = 0;
    const result = await withPolling({
      maxAttempts: 5,
      sleepTimeMs: 1,
      getValue: (): string | undefined => {
        callCount++;
        return callCount >= 2 ? "sync-found" : undefined;
      },
      found: (value): value is string => value === "sync-found",
    });

    expect(result).toBe("sync-found");
    expect(callCount).toBe(2);
  });

  it("supports abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      withPolling({
        maxAttempts: 5,
        sleepTimeMs: 1,
        getValue: (): string | undefined => undefined,
        found: (value): value is string => value !== undefined,
        signal: controller.signal,
      }),
    ).rejects.toThrow(PollingAbortedError);
  });
});
