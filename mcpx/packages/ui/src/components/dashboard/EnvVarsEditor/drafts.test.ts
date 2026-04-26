import { describe, expect, it } from "vitest";
import {
  createEnvModeDrafts,
  getValueForMode,
  syncDraftsWithValue,
} from "./drafts";

describe("env mode drafts", () => {
  it("preserves literal and fromEnv drafts when switching modes", () => {
    let drafts = createEnvModeDrafts("");

    drafts = syncDraftsWithValue(drafts, "literal-value");
    drafts = syncDraftsWithValue(drafts, { fromEnv: "UPSTREAM_ENV" });

    expect(getValueForMode(drafts, "literal")).toBe("literal-value");
    expect(getValueForMode(drafts, "fromEnv")).toEqual({
      fromEnv: "UPSTREAM_ENV",
    });
  });
});
