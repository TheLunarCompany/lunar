import { createContext, useContext } from "react";

export const FEATURE_FLAG_KEYS = [
  "VITE_ENABLE_PERMISSIONS",
  "VITE_ENABLE_CAPABILITIES_UI",
  "VITE_UI_SIDEBAR_RESTRUCTURE",
  "VITE_SHOW_MCP_SERVERS",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
export type FeatureFlagValues = Record<FeatureFlagKey, boolean>;

export type FeatureFlagsContextValue = {
  featureFlags: FeatureFlagValues;
  setFeatureFlagOverride: (key: FeatureFlagKey, value: boolean) => void;
  resetFeatureFlagOverride: (key: FeatureFlagKey) => void;
  resetFeatureFlagOverrides: () => void;
  isFeatureFlagOverridden: (key: FeatureFlagKey) => boolean;
};

export const FeatureFlagsContext =
  createContext<FeatureFlagsContextValue | null>(null);

export function useFeatureFlags(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext);
  if (context === null) {
    throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  }
  return context;
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureFlags().featureFlags[key];
}
