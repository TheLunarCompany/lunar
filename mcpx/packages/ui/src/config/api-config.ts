import { getRuntimeConfigSync } from "./runtime-config";

const MCPX_SERVER_DEFAULT_PORT = 9000;

/**
 * Get the MCPX server URL for API calls
 *
 * Configuration priority:
 * 1. Runtime config (from config.json)
 * 2. VITE_MCPX_SERVER_URL (if set, use as-is)
 * 3. VITE_MCPX_SERVER_PORT + current hostname (for enterprise deployments)
 * 4. Default localhost configuration
 *
 * This function is designed to work in enterprise deployments where
 * UI and MCPX server run in the same container but on different ports.
 */
export function getMcpxServerURL(kind: "http" | "ws"): string {
  const runtimeConfig = getRuntimeConfigSync();
  const envUrl = runtimeConfig.VITE_MCPX_SERVER_URL;
  const envPort = runtimeConfig.VITE_MCPX_SERVER_PORT;

  // If a full URL is configured, use it directly
  if (envUrl) {
    // Convert http to ws if needed
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
  if (hostname === "0.0.0.0") {
    hostname = "localhost";
  }

  return `${protocol}//${hostname}:${envPort}`;
}
