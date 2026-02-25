import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

export type MetricSnapshot = {
  timestamp: number;
  tools: number;
  servers: number;
  agents: number;
  totalRequests: number;
};

export const STORAGE_KEY = "mcpx-metrics-cache";
export const MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes

interface MetricsState {
  snapshots: MetricSnapshot[];
}

interface MetricsActions {
  addSnapshot: (snapshot: MetricSnapshot) => void;
  clearCache: () => void;
}

export type MetricsStore = MetricsState & MetricsActions;

const metricsStore = create<MetricsStore>()(
  persist(
    (set) => ({
      snapshots: [],

      addSnapshot: (snapshot) =>
        set((state) => {
          const cutoff = Date.now() - MAX_AGE_MS;
          return {
            snapshots: [
              ...state.snapshots.filter((s) => s.timestamp >= cutoff),
              snapshot,
            ],
          };
        }),

      clearCache: () => set({ snapshots: [] }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ snapshots: state.snapshots }),
    },
  ),
);

export const useMetricsStore = <T>(selector: (state: MetricsStore) => T) =>
  metricsStore(useShallow(selector));

// Direct access for non-React contexts (e.g. tests)
export const getMetricsStore = () => metricsStore;
