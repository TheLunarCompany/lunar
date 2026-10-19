import { chunk, distinct, mapValues, partition } from "./collections.js";

describe("chunk", () => {
  it("splits array into chunks of specified size", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
  });

  it("handles array length exactly divisible by size", () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it("handles array smaller than chunk size", () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("handles empty array", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("handles chunk size of 1", () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it("returns empty array for size <= 0", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([]);
    expect(chunk([1, 2, 3], -1)).toEqual([]);
  });

  it("preserves type information", () => {
    const result: string[][] = chunk(["a", "b", "c"], 2);
    expect(result).toEqual([["a", "b"], ["c"]]);
  });
});

describe("distinct", () => {
  it("removes duplicates and preserves the input's original order", () => {
    expect(distinct([3, 1, 2, 1, 5, 3, 2])).toEqual([3, 1, 2, 5]);
  });

  it("works on strings", () => {
    expect(distinct(["b", "a", "b", "c", "a"])).toEqual(["b", "a", "c"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(distinct([])).toEqual([]);
  });

  it("returns the input as-is when all values are unique", () => {
    expect(distinct([7, 2, 5, 1])).toEqual([7, 2, 5, 1]);
  });

  it("treats null and undefined as distinct values", () => {
    expect(distinct([null, undefined, null, undefined])).toEqual([
      null,
      undefined,
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [3, 1, 2, 1];
    distinct(input);
    expect(input).toEqual([3, 1, 2, 1]);
  });

  describe("reference-equality semantics for non-primitives", () => {
    it("does not dedupe Date instances with the same time (different references)", () => {
      const t = 1700000000000;
      const a = new Date(t);
      const b = new Date(t);
      expect(distinct([a, b, a])).toEqual([a, b]);
    });

    it("dedupes Date instances by reference identity", () => {
      const a = new Date(1700000000000);
      expect(distinct([a, a, a])).toEqual([a]);
    });

    it("does not dedupe equal-but-distinct plain objects", () => {
      const a = { a: 1, b: "foo" };
      const b = { a: 1, b: "foo" };
      expect(distinct([a, b])).toEqual([a, b]);
    });

    it("dedupes the same plain-object reference", () => {
      const obj = { a: 1, b: "foo" };
      expect(distinct([obj, obj])).toEqual([obj]);
    });

    it("does not dedupe equal-but-distinct arrays", () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(distinct([a, b, a])).toEqual([a, b]);
    });

    it("does not dedupe equal-but-distinct Maps", () => {
      const a = new Map<string, number>([["k", 1]]);
      const b = new Map<string, number>([["k", 1]]);
      expect(distinct([a, b])).toEqual([a, b]);
    });
  });
});

describe(".mapValues", () => {
  it("should map object values", () => {
    const obj = { a: 1, b: 2, c: 3 };
    const mapped = mapValues(obj, (value) => value * 2);
    expect(mapped).toEqual({ a: 2, b: 4, c: 6 });
  });

  it("should work with empty objects", () => {
    const obj = {};
    const mapped = mapValues(obj, (value) => value);
    expect(mapped).toEqual({});
  });

  it("should preserve keys", () => {
    const obj = { x: 10, y: 20 };
    const mapped = mapValues(obj, (value) => value + 5);
    expect(Object.keys(mapped)).toEqual(["x", "y"]);
  });

  it("should work with complex mapping functions", () => {
    const obj = { a: 1, b: 2, c: 3 };
    const mapped = mapValues(obj, (value) => ({
      original: value,
      squared: value * value,
    }));
    expect(mapped).toEqual({
      a: { original: 1, squared: 1 },
      b: { original: 2, squared: 4 },
      c: { original: 3, squared: 9 },
    });
  });

  it("should not modify the original object", () => {
    const origObj = { a: 1, b: 2 };
    const origObjCopy = { ...origObj };
    mapValues(origObj, (value) => value * 10);
    expect(origObj).toEqual(origObjCopy);
  });
});

describe("partition", () => {
  it("splits by a plain boolean predicate, preserving input order", () => {
    const [evens, odds] = partition([1, 2, 3, 4, 5, 6], (n) => n % 2 === 0);
    expect(evens).toEqual([2, 4, 6]);
    expect(odds).toEqual([1, 3, 5]);
  });

  it("refines both halves when given a type-guard predicate", () => {
    type Success = { ok: true; value: number };
    type Failure = { ok: false; error: string };
    type Outcome = Success | Failure;
    const outcomes: Outcome[] = [
      { ok: true, value: 1 },
      { ok: false, error: "boom" },
      { ok: true, value: 2 },
    ];
    const [successes, failures] = partition(
      outcomes,
      (o): o is Success => o.ok,
    );
    expect(successes.map((s) => s.value)).toEqual([1, 2]);
    expect(failures.map((f) => f.error)).toEqual(["boom"]);
  });

  it("returns two empty arrays for an empty input", () => {
    expect(partition<number>([], (n) => n > 0)).toEqual([[], []]);
  });

  it("returns ([all], []) when every item matches", () => {
    expect(partition([1, 2, 3], (n) => n > 0)).toEqual([[1, 2, 3], []]);
  });

  it("returns ([], [all]) when nothing matches", () => {
    expect(partition([1, 2, 3], (n) => n < 0)).toEqual([[], [1, 2, 3]]);
  });

  it("does not mutate the input", () => {
    const input = [1, 2, 3];
    partition(input, (n) => n > 1);
    expect(input).toEqual([1, 2, 3]);
  });
});
