import { useEffect, useState } from "react";
import { getRuntimeConfigSync } from "@/config/runtime-config";
import { getMcpxServerURL } from "@/config/api-config";
import { useRef } from "react";

export type EnterpriseAuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  isPendingAllocation: boolean;
};

type UseEnterpriseAuthOptions = {
  enabled?: boolean;
};

// Hook version so routers or views can decide what to render
export function useEnterpriseAuth(
  options: UseEnterpriseAuthOptions = {},
): EnterpriseAuthState {
  const { enabled = true } = options;
  const [state, setState] = useState<EnterpriseAuthState>({
    isLoading: true,
    isAuthenticated: false,
    error: null,
    isPendingAllocation: false,
  });
  const wasPendingRef = useRef(false);

  useEffect(() => {
    wasPendingRef.current = state.isPendingAllocation;
  }, [state.isPendingAllocation]);

  useEffect(() => {
    let isMounted = true;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const checkAuth = async () => {
      if (!isMounted) return;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      const wasPending = wasPendingRef.current;

      try {
        const runtimeConfig = getRuntimeConfigSync();
        const isEnterpriseEnabled =
          runtimeConfig.VITE_ENABLE_ENTERPRISE === "true" ||
          import.meta.env.VITE_ENABLE_ENTERPRISE === "true";

        if (!isEnterpriseEnabled) {
          if (!isMounted) return;
          setState({
            isLoading: false,
            isAuthenticated: true,
            error: null,
            isPendingAllocation: false,
          });
          return;
        }

        if (!enabled) {
          if (!isMounted) return;
          setState({
            isLoading: false,
            isAuthenticated: false,
            error: null,
            isPendingAllocation: false,
          });
          return;
        }

        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: prev.isPendingAllocation ? false : true,
          isAuthenticated: false,
          error: null,
        }));

        const response = await fetch(`${getMcpxServerURL("http")}/auth/mcpx`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (response.status === 503) {
          const message =
            (await safeReadError(response)) ||
            "Your MCPX workspace is being provisioned. We'll connect automatically when it's ready.";
          if (!isMounted) return;
          setState({
            isLoading: false,
            isAuthenticated: false,
            error: message,
            isPendingAllocation: true,
          });
          retryTimeout = setTimeout(checkAuth, 1000);
          return;
        }

        const payload = (await safeReadJson(response)) as {
          status?: string;
          error?: string;
        } | null;

        if (!isMounted) return;
        if (response.ok && payload && payload.status === "authenticated") {
          setState({
            isLoading: false,
            isAuthenticated: true,
            error: null,
            isPendingAllocation: false,
          });
        } else {
          // In enterprise mode, if we get non-auth errors (like 500s, 502s, 504s),
          // we should keep retrying as the server might be starting up.
          // Only 401/403 should trigger immediate failure.
          const isAuthError =
            response.status === 401 || response.status === 403;

          if (!isAuthError) {
            setState({
              isLoading: false,
              isAuthenticated: false,
              error: "Connecting to MCPX server...",
              isPendingAllocation: true,
            });
            retryTimeout = setTimeout(checkAuth, 1000);
            return;
          }

          setState({
            isLoading: false,
            isAuthenticated: false,
            error:
              payload?.error ||
              (!response.ok
                ? `Authentication check failed (${response.status})`
                : "You are not authenticated to the MCPX."),
            isPendingAllocation: false,
          });
          return;
        }

        setState({
          isLoading: false,
          isAuthenticated: true,
          error: null,
          isPendingAllocation: false,
        });

        if (wasPending && typeof window !== "undefined") {
          window.location.reload();
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (!isMounted) return;

        // Retry on network errors in enterprise mode
        setState({
          isLoading: false,
          isAuthenticated: false,
          error: "Unable to connect to MCPX server. Retrying...",
          isPendingAllocation: true,
        });
        retryTimeout = setTimeout(checkAuth, 1000);
      }
    };

    checkAuth();
    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [enabled]);

  return state;
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function safeReadError(response: Response): Promise<string | null> {
  try {
    const data = await response.json();
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.message === "string") return data.message;
  } catch {
    /* ignore */
  }
  try {
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
}
