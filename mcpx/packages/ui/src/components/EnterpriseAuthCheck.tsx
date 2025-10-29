import { useEffect, useState } from "react";
import { axiosClient } from "@/data/axios-client";
import { getRuntimeConfigSync } from "@/config/runtime-config";

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

        const response = await axiosClient.get("/auth/mcpx");
        const payload = response.data as { status?: string };

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
