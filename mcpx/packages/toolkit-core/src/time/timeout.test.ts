import { describe, it, expect } from "@jest/globals";
import { withTimeout, TimeoutError } from "./timeout.js";

describe("withTimeout", () => {
  describe("successful resolution", () => {
    it("returns value when promise resolves before timeout", async () => {
      const promise = Promise.resolve("success");
      const result = await withTimeout(promise, 1000);
      expect(result).toBe("success");
    });

    it("returns value when async operation completes before timeout", async () => {
      const promise = new Promise<number>((resolve) =>
        setTimeout(() => resolve(42), 10),
      );
      const result = await withTimeout(promise, 1000);
      expect(result).toBe(42);
    });
  });

  describe("timeout behavior", () => {
    it("throws TimeoutError when promise takes longer than timeout", async () => {
      const promise = new Promise<string>((resolve) =>
        setTimeout(() => resolve("too late"), 1000),
      );

      await expect(withTimeout(promise, 10)).rejects.toThrow(TimeoutError);
    });

    it("includes timeout duration in error", async () => {
      const promise = new Promise<void>(() => {});

      const error = await withTimeout(promise, 50).catch((e) => e);
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).timeoutMs).toBe(50);
    });

    it("includes operation name in error message", async () => {
      const promise = new Promise<void>(() => {});

      await expect(
        withTimeout(promise, 10, "some-long-running-job"),
      ).rejects.toThrow("some-long-running-job timed out after 10ms");
    });

    it("uses default operation name when not provided", async () => {
      const promise = new Promise<void>(() => {});

      await expect(withTimeout(promise, 10)).rejects.toThrow(
        "Operation timed out after 10ms",
      );
    });
  });

  describe("error propagation", () => {
    it("propagates rejection when promise rejects before timeout", async () => {
      const promise = Promise.reject(new Error("original error"));

      await expect(withTimeout(promise, 1000)).rejects.toThrow(
        "original error",
      );
    });

    it("propagates rejection even for fast failures", async () => {
      const promise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("fast failure")), 5),
      );

      await expect(withTimeout(promise, 1000)).rejects.toThrow("fast failure");
    });
  });

  describe("TimeoutError", () => {
    it("has correct name property", () => {
      const error = new TimeoutError("test", 100);
      expect(error.name).toBe("TimeoutError");
    });

    it("is instanceof Error", () => {
      const error = new TimeoutError("test", 100);
      expect(error).toBeInstanceOf(Error);
    });

    it("stores timeoutMs", () => {
      const error = new TimeoutError("test message", 5000);
      expect(error.timeoutMs).toBe(5000);
      expect(error.message).toBe("test message");
    });
  });
});
