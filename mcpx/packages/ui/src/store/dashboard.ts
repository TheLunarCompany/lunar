import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export const DashboardTabName = {
  Agents: "agents",
  MCPX: "mcpx",
  Servers: "servers",
  Tools: "tools",
} as const;

export type DashboardTab =
  (typeof DashboardTabName)[keyof typeof DashboardTabName];

interface DashboardActions {
  reset: () => void;
  setCurrentTab: (
    tab: DashboardTab,
    options?: { setSearch?: { agents?: string; servers?: string } },
  ) => void;
  setOptimisticallyRemovedServerName: (name: string | null) => void;
  setSearchAgentsValue: (value: string) => void;
  setSearchServersValue: (value: string) => void;
  toggleDiagramExpansion: () => void;
}

interface DashboardState {
  currentTab: DashboardTab;
  isDiagramExpanded: boolean;
  /** Server name removed optimistically so diagram updates before socket debounce. */
  optimisticallyRemovedServerName: string | null;
  searchAgentsValue: string;
  searchServersValue: string;
}

export type DashboardStore = DashboardState & DashboardActions;

const initialState: DashboardState = {
  currentTab: DashboardTabName.MCPX, // Default to MCPX tab
  isDiagramExpanded: true, // Default to expanded state
  optimisticallyRemovedServerName: null,
  searchAgentsValue: "",
  searchServersValue: "",
};

const dashboardStore = create<DashboardStore>((set) => ({
  ...initialState,
  reset: () => set({ ...initialState }),
  setOptimisticallyRemovedServerName: (name) =>
    set({ optimisticallyRemovedServerName: name }),
  setCurrentTab: (tab, options) => {
    set((state) => ({
      currentTab: tab,
      searchAgentsValue: options?.setSearch?.agents ?? state.searchAgentsValue,
      searchServersValue:
        options?.setSearch?.servers ?? state.searchServersValue,
    }));
  },
  setSearchAgentsValue: (value: string) => set({ searchAgentsValue: value }),
  setSearchServersValue: (value: string) => set({ searchServersValue: value }),
  toggleDiagramExpansion: () =>
    set((state) => ({ isDiagramExpanded: !state.isDiagramExpanded })),
}));

export const useDashboardStore = <T>(selector: (state: DashboardStore) => T) =>
  dashboardStore(useShallow(selector));
