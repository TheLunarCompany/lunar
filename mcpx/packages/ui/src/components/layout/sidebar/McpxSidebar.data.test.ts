import { afterEach, describe, expect, it, vi } from "vitest";

describe("getDefaultMcpxSidebarSections", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("includes Skills when the skills page flag is enabled", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => false,
      isUiSidebarRestructureEnabled: () => false,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const items = getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: true,
    }).flatMap((section) => section.items);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "skills", label: "Skills" }),
      ]),
    );
  });

  it("omits Skills when the skills page flag is disabled", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => false,
      isUiSidebarRestructureEnabled: () => false,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const items = getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: false,
    }).flatMap((section) => section.items);

    expect(items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "skills" })]),
    );
  });

  it("includes Capabilities in the default sections when the capabilities flag is enabled", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => true,
      isUiSidebarRestructureEnabled: () => false,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const items = getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: false,
    }).flatMap((section) => section.items);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "capabilities",
          label: "Capabilities",
        }),
      ]),
    );
  });

  it.each([false, true])(
    "includes Tools when Skills is disabled and the sidebar restructure flag is %s",
    async (isSidebarRestructureEnabled) => {
      vi.doMock("@/config/runtime-config", () => ({
        isCapabilitiesEnabled: () => false,
        isUiSidebarRestructureEnabled: () => isSidebarRestructureEnabled,
        isMcpServersShown: () => false,
      }));
      const { getDefaultMcpxSidebarSections } = await import(
        "./McpxSidebar.data"
      );

      const items = getDefaultMcpxSidebarSections({
        skillsFeatureEnabled: false,
      }).flatMap((section) => section.items);

      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "tools",
            label: "Tools",
            url: "/tools",
          }),
        ]),
      );
    },
  );

  it.each([false, true])(
    "omits Tools when Skills is enabled and the sidebar restructure flag is %s",
    async (isSidebarRestructureEnabled) => {
      vi.doMock("@/config/runtime-config", () => ({
        isCapabilitiesEnabled: () => false,
        isUiSidebarRestructureEnabled: () => isSidebarRestructureEnabled,
        isMcpServersShown: () => false,
      }));
      const { getDefaultMcpxSidebarSections } = await import(
        "./McpxSidebar.data"
      );

      const items = getDefaultMcpxSidebarSections({
        skillsFeatureEnabled: true,
      }).flatMap((section) => section.items);

      expect(items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "tools" })]),
      );
    },
  );

  it("uses the restructured sections when the sidebar restructure flag is enabled", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => true,
      isUiSidebarRestructureEnabled: () => true,
      isMcpServersShown: () => true,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const sections = getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: true,
    });

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      title: "Workspace",
      items: [
        expect.objectContaining({ id: "dashboard", label: "Dashboard" }),
        expect.objectContaining({ id: "mcp-servers", label: "MCP Servers" }),
        expect.objectContaining({ id: "skills", label: "Skills" }),
        expect.objectContaining({ id: "saved-setups", label: "Saved Setups" }),
        expect.objectContaining({ id: "audit-log", label: "Audit Log" }),
      ],
    });
    expect(sections[0].items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "capabilities" })]),
    );
    expect(sections[1]).toMatchObject({
      title: "Catalogs",
      items: [
        expect.objectContaining({ id: "mcp-registry", label: "MCP Registry" }),
      ],
    });
  });

  it("uses the Sparkles icon for Skills in the restructured sections", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => false,
      isUiSidebarRestructureEnabled: () => true,
      isMcpServersShown: () => false,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );
    const { Sparkles } = await import("lucide-react");

    const skillsItem = getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: true,
    })
      .flatMap((section) => section.items)
      .find((item) => item.id === "skills");

    expect(skillsItem?.icon).toBe(Sparkles);
  });

  it("omits MCP Servers from restructured navigation when the flag is disabled", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => false,
      isUiSidebarRestructureEnabled: () => true,
      isMcpServersShown: () => false,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const items = getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: false,
    }).flatMap((section) => section.items);

    expect(items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "mcp-servers" })]),
    );
  });

  it("includes MCP Servers in restructured navigation when the flag is enabled", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => false,
      isUiSidebarRestructureEnabled: () => true,
      isMcpServersShown: () => true,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const items = getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: false,
    }).flatMap((section) => section.items);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mcp-servers",
          label: "MCP Servers",
          url: "/mcp-servers",
        }),
      ]),
    );
  });

  it("points MCP Registry to its dedicated route", async () => {
    vi.doMock("@/config/runtime-config", () => ({
      isCapabilitiesEnabled: () => false,
      isUiSidebarRestructureEnabled: () => true,
      isMcpServersShown: () => false,
    }));
    const { getDefaultMcpxSidebarSections } = await import(
      "./McpxSidebar.data"
    );

    const registryItem = getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: false,
    })
      .flatMap((section) => section.items)
      .find((item) => item.id === "mcp-registry");

    expect(registryItem).toEqual(
      expect.objectContaining({ label: "MCP Registry", url: "/mcp-registry" }),
    );
  });
});
