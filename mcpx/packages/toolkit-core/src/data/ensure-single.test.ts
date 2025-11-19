import { Logger } from "winston";
import { ensureSingle } from "./ensure-single.js";
import { noOpLogger } from "../logging/logger.js";

describe("ensureSingle", () => {
  it("should return the first element when array has one item", () => {
    const ensure = ensureSingle(noOpLogger, "test resource");
    const result = ensure([{ id: "1" }]);
    expect(result).toEqual({ id: "1" });
  });

  it("should return null when array is empty", () => {
    const ensure = ensureSingle(noOpLogger, "test resource");
    const result = ensure([]);
    expect(result).toBeNull();
  });

  it("should return first element and warn once when multiple items exist", () => {
    const mockWarn = jest.fn();
    const mockLogger = { warn: mockWarn } as unknown as Logger;

    const ensure = ensureSingle(mockLogger, "active setup");
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const result = ensure(items);

    expect(result).toEqual({ id: "1" });
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      "Multiple active setup found when only one was expected",
      { count: 3, resourceName: "active setup" }
    );
  });

  it("should not warn when exactly one item exists", () => {
    const mockWarn = jest.fn();
    const mockLogger = { warn: mockWarn } as unknown as Logger;

    const ensure = ensureSingle(mockLogger, "user profile");
    const result = ensure([{ id: "1" }]);

    expect(result).toEqual({ id: "1" });
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("should filter by predicate and return matching item", () => {
    const ensure = ensureSingle(
      noOpLogger,
      "active item",
      (item: { id: string; active: boolean }) => item.active
    );
    const items = [
      { id: "1", active: false },
      { id: "2", active: true },
      { id: "3", active: false },
    ];
    const result = ensure(items);

    expect(result).toEqual({ id: "2", active: true });
  });

  it("should return null when no items match predicate", () => {
    const ensure = ensureSingle(
      noOpLogger,
      "active item",
      (item: { id: string; active: boolean }) => item.active
    );
    const items = [
      { id: "1", active: false },
      { id: "2", active: false },
    ];
    const result = ensure(items);

    expect(result).toBeNull();
  });

  it("should warn when multiple items match predicate", () => {
    const mockWarn = jest.fn();
    const mockLogger = { warn: mockWarn } as unknown as Logger;

    const ensure = ensureSingle(
      mockLogger,
      "active setup",
      (item: { active: boolean }) => item.active
    );
    const items = [
      { id: "1", active: true },
      { id: "2", active: true },
      { id: "3", active: false },
    ];
    const result = ensure(items);

    expect(result).toEqual({ id: "1", active: true });
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      "Multiple active setup found when only one was expected",
      { count: 3, resourceName: "active setup" }
    );
  });
});
