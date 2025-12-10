export interface RuntimeConfig {
  VITE_MCPX_SERVER_URL: string;
  VITE_MCPX_SERVER_PORT: string;
  VITE_WS_URL?: string;
  VITE_AUTH0_DOMAIN: string;
  VITE_AUTH0_CLIENT_ID: string;
  VITE_AUTH0_AUDIENCE: string;
  VITE_ENABLE_LOGIN: string;
  VITE_ENABLE_ENTERPRISE: string;
  VITE_OAUTH_CALLBACK_BASE_URL?: string;
  VITE_AUTH_BFF_URL?: string;
}

let cachedConfig: RuntimeConfig | null = null;
let configLoadPromise: Promise<RuntimeConfig> | null = null;

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (configLoadPromise) {
    return configLoadPromise;
  }

  configLoadPromise = (async (): Promise<RuntimeConfig> => {
    try {
      const res = await fetch("/config.json");
      if (!res.ok) {
        throw new Error(
          `Failed to load config: ${res.status} ${res.statusText}`,
        );
      }

      const config = await res.json();
      // Validate required fields - check for empty string as well
      if (
        !config.VITE_MCPX_SERVER_URL ||
        config.VITE_MCPX_SERVER_URL.trim() === ""
      ) {
        throw new Error(
          "VITE_MCPX_SERVER_URL is required in config.json and cannot be empty",
        );
      }

      cachedConfig = {
        ...config,
        VITE_AUTH_BFF_URL: config.VITE_AUTH_BFF_URL || "",
      };
      return cachedConfig!;
    } catch (_error) {
      // Fallback to environment variables or defaults
      const fallbackConfig: RuntimeConfig = {
        VITE_MCPX_SERVER_URL: import.meta.env.VITE_MCPX_SERVER_URL || undefined,
        VITE_MCPX_SERVER_PORT: import.meta.env.VITE_MCPX_SERVER_PORT || "9000",
        VITE_WS_URL: import.meta.env.VITE_WS_URL || undefined,
        VITE_AUTH0_DOMAIN: import.meta.env.VITE_AUTH0_DOMAIN || "",
        VITE_AUTH0_CLIENT_ID: import.meta.env.VITE_AUTH0_CLIENT_ID || "",
        VITE_AUTH0_AUDIENCE:
          import.meta.env.VITE_AUTH0_AUDIENCE || "mcpx-webapp",
        VITE_ENABLE_LOGIN: import.meta.env.VITE_ENABLE_LOGIN || "false",
        VITE_ENABLE_ENTERPRISE:
          import.meta.env.VITE_ENABLE_ENTERPRISE || "false",
        VITE_OAUTH_CALLBACK_BASE_URL:
          import.meta.env.VITE_OAUTH_CALLBACK_BASE_URL || undefined,
        VITE_AUTH_BFF_URL: import.meta.env.VITE_AUTH_BFF_URL || "",
      };

      cachedConfig = fallbackConfig;
      return fallbackConfig;
    }
  })();

  return configLoadPromise!;
}

// Synchronous version that returns cached config or fallback
export function getRuntimeConfigSync(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Return fallback if not loaded yet
  return {
    VITE_MCPX_SERVER_URL: import.meta.env.VITE_MCPX_SERVER_URL || undefined,
    VITE_MCPX_SERVER_PORT: import.meta.env.VITE_MCPX_SERVER_PORT || "9000",
    VITE_WS_URL: import.meta.env.VITE_WS_URL || undefined,
    VITE_AUTH0_DOMAIN: import.meta.env.VITE_AUTH0_DOMAIN || "",
    VITE_AUTH0_CLIENT_ID: import.meta.env.VITE_AUTH0_CLIENT_ID || "",
    VITE_AUTH0_AUDIENCE: import.meta.env.VITE_AUTH0_AUDIENCE || "mcpx-webapp",
    VITE_ENABLE_LOGIN: import.meta.env.VITE_ENABLE_LOGIN || "false",
    VITE_ENABLE_ENTERPRISE: import.meta.env.VITE_ENABLE_ENTERPRISE || "false",
    VITE_OAUTH_CALLBACK_BASE_URL:
      import.meta.env.VITE_OAUTH_CALLBACK_BASE_URL || undefined,
    VITE_AUTH_BFF_URL: import.meta.env.VITE_AUTH_BFF_URL || "",
  };
}

export function getRuntimeConfig(): RuntimeConfig | null {
  return cachedConfig;
}

export function isEnterpriseEnabled(): boolean {
  const config = getRuntimeConfigSync();
  return config.VITE_ENABLE_ENTERPRISE === "true";
}

export function getAuthBffUrl(): string | null {
  const config = getRuntimeConfigSync();
  const url = (config.VITE_AUTH_BFF_URL || "").trim();
  return url.length > 0 ? url : null;
}
