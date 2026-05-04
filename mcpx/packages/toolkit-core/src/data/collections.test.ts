import { chunk, distinct, mapValues } from "./collections.js";

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
