import { describe, it, expect } from "@jest/globals";
import { withRetries } from "./retry.js";

describe("withRetries", () => {
  describe("success", () => {
    it("returns the value on the first attempt", async () => {
      let calls = 0;
      const result = await withRetries({
        maxAttempts: 3,
        sleepTimeMs: 1,
        operation: async () => {
          calls++;
          return 42;
        },
      });

      expect(result).toBe(42);
      expect(calls).toBe(1);
    });

    it("returns the value once a later attempt succeeds", async () => {
      let calls = 0;
      const result = await withRetries({
        maxAttempts: 5,
        sleepTimeMs: 1,
        operation: async () => {
          calls++;
          if (calls < 3) throw new Error("not yet");
          return "ok";
        },
      });

      expect(result).toBe("ok");
      expect(calls).toBe(3);
    });

    it("does not call onError when the first attempt succeeds", async () => {
      const errors: unknown[] = [];
      await withRetries({
        maxAttempts: 3,
        sleepTimeMs: 1,
        operation: async () => "ok",
        onError: (error) => errors.push(error),
      });

      expect(errors).toEqual([]);
    });
  });

  describe("exhaustion", () => {
    it("rethrows the last error after exhausting maxAttempts", async () => {
      let calls = 0;
      await expect(
        withRetries({
          maxAttempts: 3,
          sleepTimeMs: 1,
          operation: async () => {
            calls++;
            throw new Error(`attempt ${calls}`);
          },
        }),
      ).rejects.toThrow("attempt 3");

      expect(calls).toBe(3);
    });

    it("runs exactly once when maxAttempts is 1", async () => {
      let calls = 0;
      await expect(
        withRetries({
          maxAttempts: 1,
          sleepTimeMs: 1,
          operation: async () => {
            calls++;
            throw new Error("boom");
          },
        }),
      ).rejects.toThrow("boom");

      expect(calls).toBe(1);
    });
  });

  describe("onError", () => {
    it("fires on every failed attempt with the 1-based attempt number", async () => {
      const attempts: number[] = [];
      await expect(
        withRetries({
          maxAttempts: 3,
          sleepTimeMs: 1,
          operation: async () => {
            throw new Error("nope");
          },
          onError: (_error, attempt) => attempts.push(attempt),
        }),
      ).rejects.toThrow("nope");

      expect(attempts).toEqual([1, 2, 3]);
    });

    it("passes the thrown error of that attempt", async () => {
      const seen: string[] = [];
      let calls = 0;
      await withRetries({
        maxAttempts: 5,
        sleepTimeMs: 1,
        operation: async () => {
          calls++;
          if (calls < 3) throw new Error(`err-${calls}`);
          return "ok";
        },
        onError: (error) =>
          seen.push(error instanceof Error ? error.message : String(error)),
      });

      expect(seen).toEqual(["err-1", "err-2"]);
    });
  });

  describe("delay", () => {
    it("waits sleepTimeMs between attempts", async () => {
      const start = Date.now();
      await expect(
        withRetries({
          maxAttempts: 3,
          sleepTimeMs: 20,
          operation: async () => {
            throw new Error("boom");
          },
        }),
      ).rejects.toThrow("boom");

      // 3 attempts => 2 inter-attempt sleeps of >=20ms each.
      expect(Date.now() - start).toBeGreaterThanOrEqual(30);
    });
  });
});
