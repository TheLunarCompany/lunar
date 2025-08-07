import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export const DashboardTabName = {
  Agents: "agents",
  MCPX: "mcpx",
  Servers: "servers",
  Tools: "tools",
} as const;

type Tab = (typeof DashboardTabName)[keyof typeof DashboardTabName];

interface DashboardActions {
  reset: () => void;
  setCurrentTab: (
    tab: Tab,
    options?: { setSearch?: { agents?: string; servers?: string } },
  ) => void;
  setSearchAgentsValue: (value: string) => void;
  setSearchServersValue: (value: string) => void;
  toggleDiagramExpansion: () => void;
}

interface DashboardState {
  currentTab: Tab;
  isDiagramExpanded: boolean;
  searchAgentsValue: string;
  searchServersValue: string;
}

export type DashboardStore = DashboardState & DashboardActions;

const initialState: DashboardState = {
  currentTab: DashboardTabName.MCPX, // Default to MCPX tab
  isDiagramExpanded: true, // Default to expanded state
  searchAgentsValue: "",
  searchServersValue: "",
};

const dashboardStore = create<DashboardStore>((set) => ({
  ...initialState,
  reset: () => set({ ...initialState }),
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
