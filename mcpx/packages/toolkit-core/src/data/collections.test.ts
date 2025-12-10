import { mapValues } from "./collections.js";

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
