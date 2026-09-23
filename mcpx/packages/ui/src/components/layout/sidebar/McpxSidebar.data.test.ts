import { describe, expect, it } from "vitest";
import { Sparkles } from "lucide-react";

import {
  getDefaultMcpxSidebarSections,
  type McpxSidebarFeatureOptions,
} from "./McpxSidebar.data";

function getSections(overrides: Partial<McpxSidebarFeatureOptions> = {}) {
  return getDefaultMcpxSidebarSections({
    skillsFeatureEnabled: false,
    capabilitiesEnabled: false,
    mcpServersShown: false,
    sidebarRestructureEnabled: false,
    ...overrides,
  });
}

function getItems(overrides: Partial<McpxSidebarFeatureOptions> = {}) {
  return getSections(overrides).flatMap((section) => section.items);
}

describe("getDefaultMcpxSidebarSections", () => {
  it("includes Skills and omits Tools when the skills flag is enabled", () => {
    const items = getItems({ skillsFeatureEnabled: true });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "skills", label: "Skills" }),
      ]),
    );
    expect(items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "tools" })]),
    );
  });

  it("omits Skills and includes Tools when the skills flag is disabled", () => {
    const items = getItems({ skillsFeatureEnabled: false });

    expect(items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "skills" })]),
    );
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tools", label: "Tools", url: "/tools" }),
      ]),
    );
  });

  it("uses the explicit capabilities value", () => {
    expect(getItems({ capabilitiesEnabled: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "capabilities",
          label: "Capabilities",
        }),
      ]),
    );
    expect(getItems({ capabilitiesEnabled: false })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "capabilities" })]),
    );
  });

  it("uses restructured sections when explicitly enabled", () => {
    const sections = getSections({
      skillsFeatureEnabled: true,
      mcpServersShown: true,
      sidebarRestructureEnabled: true,
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

  it("uses the Sparkles icon for Skills in restructured sections", () => {
    const skillsItem = getItems({
      skillsFeatureEnabled: true,
      sidebarRestructureEnabled: true,
    }).find((item) => item.id === "skills");

    expect(skillsItem?.icon).toBe(Sparkles);
  });

  it("uses the explicit MCP Servers value in restructured sections", () => {
    expect(
      getItems({
        mcpServersShown: false,
        sidebarRestructureEnabled: true,
      }),
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "mcp-servers" })]),
    );
    expect(
      getItems({
        mcpServersShown: true,
        sidebarRestructureEnabled: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mcp-servers",
          label: "MCP Servers",
          url: "/mcp-servers",
        }),
      ]),
    );
  });

  it("points MCP Registry to its dedicated route", () => {
    const registryItem = getItems({
      sidebarRestructureEnabled: true,
    }).find((item) => item.id === "mcp-registry");

    expect(registryItem).toEqual(
      expect.objectContaining({ label: "MCP Registry", url: "/mcp-registry" }),
    );
  });
});
