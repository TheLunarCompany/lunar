import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_RANGE, parseTimeRange } from "./metrics-time-range";

describe("parseTimeRange", () => {
  it("accepts valid range values", () => {
    expect(parseTimeRange("15")).toBe(15);
    expect(parseTimeRange("30")).toBe(30);
    expect(parseTimeRange("60")).toBe(60);
  });

  it("falls back to default for missing range", () => {
    expect(parseTimeRange(null)).toBe(DEFAULT_TIME_RANGE);
  });

  it("falls back to default for invalid values", () => {
    expect(parseTimeRange("")).toBe(DEFAULT_TIME_RANGE);
    expect(parseTimeRange("abc")).toBe(DEFAULT_TIME_RANGE);
    expect(parseTimeRange("10")).toBe(DEFAULT_TIME_RANGE);
    expect(parseTimeRange("120")).toBe(DEFAULT_TIME_RANGE);
    expect(parseTimeRange("15.5")).toBe(DEFAULT_TIME_RANGE);
  });
});
