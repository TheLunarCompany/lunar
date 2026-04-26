import { describe, expect, it } from "vitest";

import { resolveToolAnnotations } from "./useToolCatalog";

describe("resolveToolAnnotations", () => {
  it("returns undefined when a tool has no backend annotations", () => {
    expect(
      resolveToolAnnotations({
        name: "delete_user",
        inputSchema: { type: "object" },
      }),
    ).toBeUndefined();
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
        name: "delete_user",
        inputSchema: { type: "object" },
        annotations,
      }),
    ).toEqual(annotations);
  });
});
