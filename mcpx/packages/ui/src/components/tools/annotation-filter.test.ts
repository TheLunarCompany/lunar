import { describe, expect, it } from "vitest";

import {
  matchesAnnotationFilter,
  type AnnotationFilterValue,
} from "./annotation-filter";

type ToolStub = Parameters<typeof matchesAnnotationFilter>[0];

function createTool(overrides?: Partial<ToolStub>): ToolStub {
  return {
    name: "tool",
    description: "",
    serviceName: "server",
    annotations: {},
    ...overrides,
  };
}

describe("matchesAnnotationFilter", () => {
  it("matches all tools when no filters are selected", () => {
    expect(matchesAnnotationFilter(createTool(), [])).toBe(true);
  });

  it("matches read-only tools", () => {
    expect(
      matchesAnnotationFilter(
        createTool({ annotations: { readOnlyHint: true } }),
        ["read-only"],
      ),
    ).toBe(true);
  });

  it("matches destructive tools", () => {
    expect(
      matchesAnnotationFilter(
        createTool({ annotations: { destructiveHint: true } }),
        ["destructive"],
      ),
    ).toBe(true);
  });

  it("matches write tools when they are neither read-only nor destructive", () => {
    expect(
      matchesAnnotationFilter(createTool({ annotations: {} }), ["write"]),
    ).toBe(true);
  });

  it("supports selecting multiple filter categories at once", () => {
    const filters: AnnotationFilterValue[] = ["read-only", "destructive"];

    expect(
      matchesAnnotationFilter(
        createTool({ annotations: { readOnlyHint: true } }),
        filters,
      ),
    ).toBe(true);
    expect(
      matchesAnnotationFilter(
        createTool({ annotations: { destructiveHint: true } }),
        filters,
      ),
    ).toBe(true);
    expect(
      matchesAnnotationFilter(createTool({ annotations: {} }), filters),
    ).toBe(false);
  });
});
