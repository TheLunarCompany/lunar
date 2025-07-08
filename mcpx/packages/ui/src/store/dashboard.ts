import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export const DashboardTabName = {
  Agents: "agents",
  MCPX: "mcpx",
  Servers: "servers",
  Tools: "tools",
} as const;

type Tab = (typeof DashboardTabName)[keyof typeof DashboardTabName];

export interface DashboardStore {
  currentTab?: Tab;
  isDiagramExpanded: boolean;
  searchAgents: (value: string) => void;
  searchServers: (value: string) => void;
  searchAgentsValue?: string;
  searchServersValue?: string;
  setCurrentTab: (
    tab: Tab,
    options?: { setSearch?: { agents?: string; servers?: string } },
  ) => void;
  toggleDiagramExpansion: () => void;
}

const dashboardStore = create<DashboardStore>((set) => ({
  currentTab: DashboardTabName.MCPX, // Default to MCPX tab
  isDiagramExpanded: true, // Default to expanded state
  setCurrentTab: (tab, options) => {
    set((state) => ({
      currentTab: tab,
      searchAgentsValue: options?.setSearch?.agents ?? state.searchAgentsValue,
      searchServersValue:
        options?.setSearch?.servers ?? state.searchServersValue,
    }));
  },
  searchAgents: (value: string) => set({ searchAgentsValue: value }),
  searchServers: (value: string) => set({ searchServersValue: value }),
  searchAgentsValue: "",
  searchServersValue: "",
  toggleDiagramExpansion: () =>
    set((state) => ({ isDiagramExpanded: !state.isDiagramExpanded })),
}));

export const useDashboardStore = <T>(selector: (state: DashboardStore) => T) =>
  dashboardStore(useShallow(selector));
