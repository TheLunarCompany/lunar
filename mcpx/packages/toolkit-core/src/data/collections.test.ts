import { chunk } from "./collections.js";
import { mapValues } from "./collections.js";

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
