import { describe, it, expect } from "@jest/globals";
import { runCapped } from "./run-capped.js";

describe("runCapped", () => {
  it("answers the results in the items' order, whatever order calls finish in", async () => {
    const delays = [30, 5, 20, 0];
    const results = await runCapped(delays, 2, async (delay) => {
      await new Promise((r) => setTimeout(r, delay));
      return delay * 10;
    });
    expect(results).toEqual([300, 50, 200, 0]);
  });

  it("never runs more than limit calls at once", async () => {
    let running = 0;
    let peak = 0;
    await runCapped(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async (i) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, i % 3));
        running--;
      },
    );
    expect(peak).toBe(3);
  });

  it("starts the next item as soon as one slot frees, without waiting for the others", async () => {
    const events: string[] = [];
    const results = await runCapped(
      ["slow", "fast", "next"],
      2,
      async (item) => {
        events.push(`start ${item}`);
        if (item === "slow") await new Promise((r) => setTimeout(r, 30));
        events.push(`end ${item}`);
        return item;
      },
    );
    expect(events.indexOf("start next")).toBeLessThan(
      events.indexOf("end slow"),
    );
    expect(results).toEqual(["slow", "fast", "next"]);
  });

  it("answers an empty array for no items", async () => {
    expect(await runCapped([], 4, async () => 1)).toEqual([]);
  });

  it("rejects with the error of a call that rejects", async () => {
    const run = runCapped([1, 2, 3], 2, async (i) => {
      if (i === 2) throw new Error("boom");
      return i;
    });
    await expect(run).rejects.toThrow("boom");
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses limit %p", async (limit) => {
    await expect(runCapped([1], limit, async (i) => i)).rejects.toThrow(
      RangeError,
    );
  });
});
