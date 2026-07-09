import { afterEach, describe, expect, it, vi } from "vitest";

describe("getDefaultMcpxSidebarSections", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("includes Skills when the skills page flag is enabled", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => false,
      isSkillsPageEnabled: () => true,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const items = getDefaultMcpxSidebarSections().flatMap(
      (section) => section.items,
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "skills", label: "Skills" }),
      ]),
    );
  });

  it("omits Skills when the skills page flag is disabled", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => false,
      isSkillsPageEnabled: () => false,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const items = getDefaultMcpxSidebarSections().flatMap(
      (section) => section.items,
    );

    expect(items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "skills" })]),
    );
  });
});
