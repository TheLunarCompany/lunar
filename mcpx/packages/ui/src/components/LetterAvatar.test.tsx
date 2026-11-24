import { describe, expect, it } from "vitest";
import { getAvatarBackgroundColor } from "./letter-avatar-colors";

describe("getAvatarBackgroundColor", () => {
  it("maps a skill name directly to an Exosphere data role", () => {
    expect(getAvatarBackgroundColor("Alpha")).toContain(
      "var(--mcpx-data-green)",
    );
  });
});
