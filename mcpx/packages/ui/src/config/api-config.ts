const WEBSERVER_DEFAULT_PORT = 9001;

// Dynamic API configuration that works for both local and remote access
export function getWebServerURL(kind: "http" | "ws"): string {
  // First check if runtime configuration is available (injected at container startup)
  if (typeof window !== 'undefined' && (window as any).RUNTIME_CONFIG) {
    try {
      const runtimeUrl = kind === "http" 
        ? (window as any).RUNTIME_CONFIG.VITE_API_SERVER_URL
        : (window as any).RUNTIME_CONFIG.VITE_WS_URL;
      
      if (runtimeUrl) {
        // Basic URL validation
        const parsedUrl = new URL(runtimeUrl);
        if (kind === "ws") {
          if (parsedUrl.protocol === 'ws:' || parsedUrl.protocol === 'wss:') {
            return runtimeUrl;
          } else {
            console.error("Invalid WebSocket protocol in runtime config:", parsedUrl.protocol);
          }
        } else {
          return runtimeUrl;
        }
      }
    } catch (error) {
      console.error("Invalid runtime config URL, using fallback:", error);
      // Continue with fallback logic
    }
  }

  // Check environment variables (for development mode)
  const envUrl = import.meta.env.VITE_API_SERVER_URL;
  
  // If we're in development mode (vite dev server), use the environment variable
  if (import.meta.env.DEV) {
    return envUrl || `http://127.0.0.1:${WEBSERVER_DEFAULT_PORT}`;
  }

  if (
    envUrl &&
    !envUrl.includes("localhost") &&
    !envUrl.includes("127.0.0.1")
  ) {
    return envUrl;
  }

  // In production, construct URL based on current window location
  // This assumes the API is accessible on the same host but different port
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

  const apiPort = import.meta.env.VITE_WEBSERVER_PORT || WEBSERVER_DEFAULT_PORT;

  return `${protocol}//${hostname}:${apiPort}`;
}