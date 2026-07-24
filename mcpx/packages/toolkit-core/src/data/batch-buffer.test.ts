import { noOpLogger } from "../logging/logger.js";
import { createLatch } from "../test/latch.js";
import {
  createManualIntervalClock,
  ManualIntervalClock,
} from "../time/clock.js";
import { BatchBuffer } from "./batch-buffer.js";

interface MakeBufferResult<T> {
  buf: BatchBuffer<T>;
  clock: ManualIntervalClock;
}

function makeBuffer<T>(params: {
  flushIntervalMs?: number;
  maxBufferSize?: number;
  onFlush: (items: T[]) => void | Promise<void>;
}): MakeBufferResult<T> {
  const clock = createManualIntervalClock();
  const buf = new BatchBuffer<T>({
    name: "test",
    flushIntervalMs: params.flushIntervalMs ?? 10000,
    maxBufferSize: params.maxBufferSize ?? 10,
    logger: noOpLogger,
    clock,
    onFlush: params.onFlush,
  });
  return { buf, clock };
}

describe("BatchBuffer", () => {
  describe("add()", () => {
    it("accumulates items without flushing when under maxBufferSize", async () => {
      const flushed: number[][] = [];
      const { buf, clock: _clock } = makeBuffer<number>({
        maxBufferSize: 5,
        onFlush: (items) => {
          flushed.push([...items]);
        },
      });

      buf.start();
      buf.add([1, 2, 3]);
      await Promise.resolve(); // drain microtask queue — clock was never ticked, so no interval flush either

      expect(flushed).toHaveLength(0);
      buf.stop();
    });

    it("flushes immediately when maxBufferSize is reached", async () => {
      const latch = createLatch();
      const flushed: number[][] = [];
      const { buf } = makeBuffer<number>({
        maxBufferSize: 3,
        onFlush: (items) => {
          flushed.push([...items]);
          latch.resolve();
        },
      });

      buf.start();
      buf.add([1, 2, 3]);
      await latch.promise;
      buf.stop();

      expect(flushed).toHaveLength(1);
      expect(flushed[0]).toEqual([1, 2, 3]);
    });

    it("flushes immediately when items push buffer past maxBufferSize", async () => {
      const latch = createLatch();
      const flushed: number[][] = [];
      const { buf } = makeBuffer<number>({
        maxBufferSize: 3,
        onFlush: (items) => {
          flushed.push([...items]);
          latch.resolve();
        },
      });

      buf.start();
      buf.add([1, 2]);
      buf.add([3, 4]);
      await latch.promise;
      buf.stop();

      expect(flushed).toHaveLength(1);
      expect(flushed[0]).toEqual([1, 2, 3, 4]);
    });
  });

  describe("interval flush via start()", () => {
    it("flushes on interval tick when items are pending", async () => {
      const latch = createLatch();
      const flushed: number[][] = [];
      const { buf, clock } = makeBuffer<number>({
        maxBufferSize: 10000, // deliberately large to avoid interference from size-based flushing
        onFlush: (items) => {
          flushed.push([...items]);
          latch.resolve();
        },
      });

      buf.start();
      buf.add([10, 20]);
      clock.tick();

      await latch.promise;
      buf.stop();

      expect(flushed).toHaveLength(1);
      expect(flushed[0]).toEqual([10, 20]);
    });

    it("does not call onFlush when buffer is empty on interval tick", async () => {
      const flushed: number[][] = [];
      const { buf, clock } = makeBuffer<number>({
        maxBufferSize: 10000,
        onFlush: (items) => {
          flushed.push([...items]);
        },
      });

      buf.start();
      clock.tick();
      await Promise.resolve();
      buf.stop();

      // no empty array - nothing flushed
      expect(flushed).toHaveLength(0);
    });
  });

  describe("shutdown()", () => {
    it("flushes remaining items and stops the interval", async () => {
      const flushed: number[][] = [];
      const { buf, clock } = makeBuffer<number>({
        maxBufferSize: 10000,
        onFlush: (items) => {
          flushed.push([...items]);
        },
      });

      buf.start();
      buf.add([7, 8, 9]);

      await buf.shutdown();

      expect(flushed).toHaveLength(1);
      expect(flushed[0]).toEqual([7, 8, 9]);

      // Verify interval is stopped — ticking should not trigger another flush
      clock.tick();
      await Promise.resolve();

      expect(flushed).toHaveLength(1);
    });

    it("does not call onFlush when buffer is empty at shutdown", async () => {
      const flushed: number[][] = [];
      const { buf } = makeBuffer<number>({
        onFlush: (items) => {
          flushed.push([...items]);
        },
      });

      buf.start();
      await buf.shutdown();

      expect(flushed).toHaveLength(0);
    });
  });

  describe("buffer swap prevents duplicate flush", () => {
    it("items added during an in-flight flush are not lost and appear in the next flush", async () => {
      const flushCalls: number[][] = [];
      const firstFlushLatch = createLatch();
      const { buf } = makeBuffer<number>({
        maxBufferSize: 2,
        onFlush: async (items) => {
          flushCalls.push([...items]);
          if (flushCalls.length === 1) {
            // At this point the buffer was already swapped — [3] hasn't been added yet
            // but even when it is (line below), it won't be in this flush's items
            expect(items).toEqual([1, 2]);
            await firstFlushLatch.promise; // simulate slow first flush
          }
        },
      });

      buf.start();
      buf.add([1, 2]); // triggers first flush — buffer swapped synchronously before onFlush awaits
      buf.add([3]); // arrives while first flush is still in-flight; goes into the new empty buffer

      firstFlushLatch.resolve(); // unblock first flush
      await Promise.resolve(); // let first flush complete

      await buf.shutdown(); // flushes remaining [3]

      expect(flushCalls[0]).toEqual([1, 2]);
      expect(flushCalls[1]).toEqual([3]);
    });
  });
});
