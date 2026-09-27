import { beforeEach, describe, expect, it } from "vitest";
import { DashboardTabName, dashboardStore } from "./dashboard";

describe("dashboardStore", () => {
  beforeEach(() => {
    dashboardStore.getState().reset();
  });

  it("starts from the expected default state", () => {
    expect(dashboardStore.getState()).toMatchObject({
      currentTab: DashboardTabName.MCPX,
      isDiagramExpanded: true,
      optimisticallyRemovedServerName: null,
      searchAgentsValue: "",
      searchServersValue: "",
    });
  });

  it("updates the active tab while preserving search values by default", () => {
    dashboardStore.getState().setSearchAgentsValue("claude");
    dashboardStore.getState().setSearchServersValue("filesystem");

    dashboardStore.getState().setCurrentTab(DashboardTabName.Agents);

    expect(dashboardStore.getState()).toMatchObject({
      currentTab: DashboardTabName.Agents,
      searchAgentsValue: "claude",
      searchServersValue: "filesystem",
    });
  });

  it("applies optional search overrides, toggles expansion, and resets", () => {
    dashboardStore.getState().setCurrentTab(DashboardTabName.Servers, {
      setSearch: { agents: "codex", servers: "slack" },
    });
    dashboardStore
      .getState()
      .setOptimisticallyRemovedServerName("temporary-server");
    dashboardStore.getState().toggleDiagramExpansion();

    expect(dashboardStore.getState()).toMatchObject({
      currentTab: DashboardTabName.Servers,
      isDiagramExpanded: false,
      optimisticallyRemovedServerName: "temporary-server",
      searchAgentsValue: "codex",
      searchServersValue: "slack",
    });

    dashboardStore.getState().reset();

    expect(dashboardStore.getState()).toMatchObject({
      currentTab: DashboardTabName.MCPX,
      isDiagramExpanded: true,
      optimisticallyRemovedServerName: null,
      searchAgentsValue: "",
      searchServersValue: "",
    });
  });
});
