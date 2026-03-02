import { getRuntimeConfigSync } from "./runtime-config";

/**
 * Get the MCPX server URL for API calls
 *
 * Configuration priority:
 * 1. Runtime config (from config.json)
 * 2. VITE_MCPX_SERVER_URL (if set, use as-is)
 * 3. VITE_MCPX_SERVER_PORT + current hostname
 */
export function getMcpxServerURL(kind: "http" | "ws"): string {
  const runtimeConfig = getRuntimeConfigSync();
  const envUrl = runtimeConfig.VITE_MCPX_SERVER_URL;
  if (envUrl && runtimeConfig.VITE_ENABLE_ENTERPRISE === "true") {
    return envUrl;
  }

  const envPort = runtimeConfig.VITE_MCPX_SERVER_PORT;

  // If a full URL is configured, use it directly
  if (envUrl) {
    if (kind === "ws") {
      return envUrl.replace(
        /^https?:/,
        envUrl.startsWith("https:") ? "wss:" : "ws:",
      );
    }
    return envUrl;
  }

  // For enterprise deployments, construct URL using current hostname + configured port
  // This allows UI and MCPX to communicate within the same container
  let protocol: string;
  switch (kind) {
    case "http":
      protocol = window.location.protocol;
      break;
    case "ws":
      protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      break;
  }

  let hostname = window.location.hostname;

  // Handle 0.0.0.0 which browsers don't handle well for CORS
  if (hostname === "0.0.0.0" || hostname === "127.0.0.1") {
    hostname = "localhost";
  }

  return `${protocol}//${hostname}:${envPort}`;
}

export function getMcpxServerURLSync(): string {
  const runtimeConfig = getRuntimeConfigSync();

  if (runtimeConfig.VITE_MCPX_SERVER_URL) {
    return runtimeConfig.VITE_MCPX_SERVER_URL;
  }

  // Fallback: construct URL from current location
  if (typeof window !== "undefined") {
    const port = runtimeConfig.VITE_MCPX_SERVER_PORT || "9000";
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }

  return "";
}
