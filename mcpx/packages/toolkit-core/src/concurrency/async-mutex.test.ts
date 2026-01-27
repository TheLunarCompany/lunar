import { describe, it, expect } from "@jest/globals";
import { AsyncMutex } from "./async-mutex.js";

describe("AsyncMutex", () => {
  it("executes a single operation and returns result", async () => {
    const mutex = new AsyncMutex();
    const result = await mutex.withLock(async () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it("serializes concurrent operations", async () => {
    const mutex = new AsyncMutex();
    const executionOrder: number[] = [];

    const operation = (id: number, delay: number) =>
      mutex.withLock(async () => {
        executionOrder.push(id);
        await new Promise((r) => setTimeout(r, delay));
        executionOrder.push(id * 10);
        return id;
      });

    // Start 3 operations concurrently with different delays
    // If mutex works, they should execute in order despite op1 being slower
    const [r1, r2, r3] = await Promise.all([
      operation(1, 30), // slow
      operation(2, 10), // fast
      operation(3, 10), // fast
    ]);

    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(r3).toBe(3);

    // Execution order should be strictly sequential: start1, end1, start2, end2, start3, end3
    expect(executionOrder).toEqual([1, 10, 2, 20, 3, 30]);
  });

  it("releases lock after error (no deadlock)", async () => {
    const mutex = new AsyncMutex();
    const results: string[] = [];

    // First operation throws
    const op1 = mutex.withLock(async () => {
      results.push("op1-start");
      throw new Error("op1 failed");
    });

    // Second operation should still execute after first fails
    const op2 = mutex.withLock(async () => {
      results.push("op2-start");
      return "op2-done";
    });

    await expect(op1).rejects.toThrow("op1 failed");
    const result2 = await op2;

    expect(result2).toBe("op2-done");
    expect(results).toEqual(["op1-start", "op2-start"]);
  });

  it("maintains order even with multiple failing operations", async () => {
    const mutex = new AsyncMutex();
    const executionOrder: number[] = [];

    const failingOp = (id: number) =>
      mutex.withLock(async () => {
        executionOrder.push(id);
        throw new Error(`op${id} failed`);
      });

    const successOp = (id: number) =>
      mutex.withLock(async () => {
        executionOrder.push(id);
        return id;
      });

    const results = await Promise.allSettled([
      failingOp(1),
      failingOp(2),
      successOp(3),
      failingOp(4),
      successOp(5),
    ]);

    // All operations should execute in order
    expect(executionOrder).toEqual([1, 2, 3, 4, 5]);

    // Check individual results
    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("rejected");
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 });
    expect(results[3].status).toBe("rejected");
    expect(results[4]).toEqual({ status: "fulfilled", value: 5 });
  });

  /**
   * WARNING: This test documents a DEADLOCK scenario.
   * DO NOT await a nested withLock call - it will hang forever!
   *
   * The test uses a timeout to demonstrate the deadlock without actually hanging.
   */
  it("DEADLOCKS on nested awaited withLock calls - DO NOT DO THIS", async () => {
    const mutex = new AsyncMutex();
    let deadlockDetected = false;

    // This pattern WILL DEADLOCK:
    // - Outer call holds the lock
    // - Inner call queues behind outer
    // - Outer awaits inner
    // - Inner waits for outer to release
    // - Neither can proceed = DEADLOCK
    const deadlockPromise = mutex.withLock(async () => {
      await mutex.withLock(async () => {
        // This will NEVER execute
        return "inner";
      });
      return "outer";
    });

    // Race against a timeout to detect the deadlock
    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => {
        deadlockDetected = true;
        resolve("timeout");
      }, 100),
    );

    const result = await Promise.race([deadlockPromise, timeoutPromise]);

    expect(result).toBe("timeout");
    expect(deadlockDetected).toBe(true);
    // The deadlockPromise is still pending forever - this is the bug we're documenting
  });

  it("preserves error type when operation throws", async () => {
    const mutex = new AsyncMutex();

    class CustomError extends Error {
      constructor(public code: number) {
        super(`Custom error ${code}`);
        this.name = "CustomError";
      }
    }

    await expect(
      mutex.withLock(async () => {
        throw new CustomError(404);
      }),
    ).rejects.toThrow(CustomError);

    // Mutex should still work after custom error
    const result = await mutex.withLock(async () => "recovered");
    expect(result).toBe("recovered");
  });
});
