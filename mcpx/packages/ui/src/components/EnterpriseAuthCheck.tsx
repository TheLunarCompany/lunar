import { useEffect, useState } from "react";
import { getRuntimeConfigSync } from "@/config/runtime-config";
import { getMcpxServerURL } from "@/config/api-config";

export type EnterpriseAuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
};

// Hook version so routers or views can decide what to render
export function useEnterpriseAuth(): EnterpriseAuthState {
  const [state, setState] = useState<EnterpriseAuthState>({
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const runtimeConfig = getRuntimeConfigSync();
        const isEnterpriseEnabled =
          runtimeConfig.VITE_ENABLE_ENTERPRISE === "true" ||
          import.meta.env.VITE_ENABLE_ENTERPRISE === "true";

        if (!isEnterpriseEnabled) {
          if (!isMounted) return;
          setState({ isLoading: false, isAuthenticated: true, error: null });
          return;
        }

        const response = await fetch(`${getMcpxServerURL("http")}/auth/mcpx`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error("Auth check failed:", response.statusText);
        }

        const payload = (await response.json()) as { status?: string };

        if (!isMounted) return;
        if (payload && payload.status === "authenticated") {
          setState({ isLoading: false, isAuthenticated: true, error: null });
        } else {
          setState({
            isLoading: false,
            isAuthenticated: false,
            error: "You are not authenticated to the MCPX.",
          });
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (!isMounted) return;
        setState({
          isLoading: false,
          isAuthenticated: false,
          error:
            "Unable to verify authentication. Please check your connection to the MCPX server.",
        });
      }
    };

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
