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
  selectedId?: string;
  setCurrentTab: (tab: Tab) => void;
  setSelectedId?: (id: string) => void;
}

const dashboardStore = create<DashboardStore>((set) => ({
  currentTab: DashboardTabName.MCPX,
  selectedId: "mcpx", // Default to MCPX node
  setCurrentTab: (tab: Tab) => set({ currentTab: tab }),
  setSelectedId: (id: string) => set({ selectedId: id }),
}));

export const useDashboardStore = <T>(selector: (state: DashboardStore) => T) =>
  dashboardStore(useShallow(selector));
