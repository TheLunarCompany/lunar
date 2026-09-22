import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Capabilities page boundary", () => {
  it("uses only the capability-owned catalog shell and no Tools internals", () => {
    const source = readFileSync("src/pages/Capabilities.tsx", "utf8");

    expect(source).toContain("@/components/capabilities/CapabilitiesCatalog");
    expect(source).not.toContain("@/components/tools/");
    expect(source).not.toContain("./NewToolCatalog");
    expect(source).not.toContain("@/hooks/useToolCatalog");
    expect(source).not.toContain("ToolsItem");
    expect(source).not.toContain("useToolsStore");
    expect(source).not.toContain("toolsStore");
    expect(source).not.toContain("initToolsStore");
  });
});
