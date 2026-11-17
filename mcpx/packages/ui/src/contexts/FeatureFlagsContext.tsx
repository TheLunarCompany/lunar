import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod/v4";

import { getRuntimeConfigSync } from "@/config/runtime-config";
import {
  FEATURE_FLAG_KEYS,
  FeatureFlagsContext,
  type FeatureFlagKey,
  type FeatureFlagValues,
} from "./feature-flags";

type FeatureFlagOverrides = Partial<FeatureFlagValues>;

const FEATURE_FLAG_OVERRIDES_STORAGE_KEY = "mcpx-ui:config-overrides";

function developmentOverridesEnabled(): boolean {
  return import.meta.env.DEV;
}

function getBaseFeatureFlags(): FeatureFlagValues {
  const runtimeConfig = getRuntimeConfigSync();

  return Object.fromEntries(
    FEATURE_FLAG_KEYS.map((key) => [key, runtimeConfig[key] === "true"]),
  ) as FeatureFlagValues;
}

function removeStoredFeatureFlagOverrides(): void {
  try {
    window.localStorage.removeItem(FEATURE_FLAG_OVERRIDES_STORAGE_KEY);
  } catch {
    // Storage may be unavailable. In-memory overrides still work.
  }
}

function readFeatureFlagOverrides(): FeatureFlagOverrides {
  if (!developmentOverridesEnabled() || typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(FEATURE_FLAG_OVERRIDES_STORAGE_KEY);
    if (raw === null) return {};

    const parsed: unknown = JSON.parse(raw);
    const parsedObject = z.record(z.string(), z.unknown()).safeParse(parsed);
    if (!parsedObject.success) {
      removeStoredFeatureFlagOverrides();
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedObject.data).filter(
        ([key, value]) =>
          FEATURE_FLAG_KEYS.includes(key as FeatureFlagKey) &&
          z.boolean().safeParse(value).success,
      ),
    ) as FeatureFlagOverrides;
  } catch {
    removeStoredFeatureFlagOverrides();
    return {};
  }
}

function writeFeatureFlagOverrides(overrides: FeatureFlagOverrides): void {
  if (!developmentOverridesEnabled() || typeof window === "undefined") return;

  try {
    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(FEATURE_FLAG_OVERRIDES_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      FEATURE_FLAG_OVERRIDES_STORAGE_KEY,
      JSON.stringify(overrides),
    );
  } catch {
    // Storage may be unavailable. Preserve the in-memory override.
  }
}

export function FeatureFlagsProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [baseFeatureFlags] = useState(getBaseFeatureFlags);
  const [featureFlagOverrides, setFeatureFlagOverrides] = useState(
    readFeatureFlagOverrides,
  );

  const featureFlags = {
    ...baseFeatureFlags,
    ...featureFlagOverrides,
  };

  useEffect(() => {
    writeFeatureFlagOverrides(featureFlagOverrides);
  }, [featureFlagOverrides]);

  function setFeatureFlagOverride(key: FeatureFlagKey, value: boolean): void {
    if (!developmentOverridesEnabled()) return;
    setFeatureFlagOverrides((current) => ({ ...current, [key]: value }));
  }

  function resetFeatureFlagOverride(key: FeatureFlagKey): void {
    if (!developmentOverridesEnabled()) return;
    setFeatureFlagOverrides((current) => {
      const { [key]: _removed, ...remaining } = current;
      return remaining;
    });
  }

  function resetFeatureFlagOverrides(): void {
    if (!developmentOverridesEnabled()) return;
    setFeatureFlagOverrides({});
  }

  function isFeatureFlagOverridden(key: FeatureFlagKey): boolean {
    return (
      developmentOverridesEnabled() &&
      Object.prototype.hasOwnProperty.call(featureFlagOverrides, key)
    );
  }

  return (
    <FeatureFlagsContext.Provider
      value={{
        featureFlags,
        setFeatureFlagOverride,
        resetFeatureFlagOverride,
        resetFeatureFlagOverrides,
        isFeatureFlagOverridden,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}
