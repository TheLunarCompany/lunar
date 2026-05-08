import { describe, expect, it } from "vitest";

import { resolveToolAnnotations } from "./useToolCatalog";

describe("resolveToolAnnotations", () => {
  it("returns undefined when a tool has no backend annotations", () => {
    expect(resolveToolAnnotations({})).toBeUndefined();
  });

  it("preserves backend annotations when they exist", () => {
    const annotations = {
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    };

    expect(
      resolveToolAnnotations({
        annotations,
      }),
    ).toEqual(annotations);
  });
});
