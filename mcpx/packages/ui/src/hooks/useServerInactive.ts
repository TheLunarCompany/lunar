import { useMemo } from "react";
import { useSocketStore } from "@/store";
import { type AppConfig } from "@mcpx/shared-model";

/**
 * Helper function to check if a server is marked as inactive in appConfig
 * This can be used outside of React components
 */
export const isServerInactive = (
  serverName: string,
  appConfig: AppConfig | null | undefined,
): boolean => {
  const appConfigTyped = appConfig as
    | (AppConfig & {
        targetServerAttributes?: Record<string, { inactive: boolean }>;
      })
    | null;

  if (!appConfigTyped?.targetServerAttributes) {
    return false;
  }

  const targetServerAttributes = appConfigTyped.targetServerAttributes;
  const normalizedServerName = serverName.toLowerCase().trim();

  // Try original name first
  let serverAttributes = targetServerAttributes[serverName];
  // Try normalized name
  if (!serverAttributes) {
    serverAttributes = targetServerAttributes[normalizedServerName];
  }
  // Fallback: search for matching key (case-insensitive)
  if (!serverAttributes) {
    const matchingKey = Object.keys(targetServerAttributes).find(
      (key) => key.toLowerCase().trim() === normalizedServerName,
    );
    if (matchingKey) {
      serverAttributes = targetServerAttributes[matchingKey];
    }
  }

  return serverAttributes?.inactive === true;
};

/**
 * Hook to check if a server is marked as inactive in appConfig
 * @param serverName - The name of the server to check
 * @returns boolean - true if the server is inactive, false otherwise
 */
export const useServerInactive = (serverName: string): boolean => {
  const { appConfig } = useSocketStore((s) => ({
    appConfig: s.appConfig,
  }));

  return useMemo(
    () => isServerInactive(serverName, appConfig),
    [appConfig, serverName],
  );
};
