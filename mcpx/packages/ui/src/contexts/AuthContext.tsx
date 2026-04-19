"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAuthBffUrl, isEnterpriseEnabled } from "@/config/runtime-config";
import { AuthContext } from "./auth-internal";
import { AuthContextValue, AuthState } from "./auth-types";

export type { AuthUser, AuthState, AuthContextValue } from "./auth-types";

function normalizeBaseUrl(url: string | null): string | null {
  if (!url) return null;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const loginRequired = useMemo(() => isEnterpriseEnabled(), []);
  const rawAuthBffUrl = getAuthBffUrl();
  const authBffBase = useMemo(
    () => normalizeBaseUrl(rawAuthBffUrl),
    [rawAuthBffUrl],
  );

  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    isAuthenticated: !loginRequired,
    loading: loginRequired,
    error:
      loginRequired && !authBffBase
        ? "Enterprise login is enabled but VITE_AUTH_BFF_URL is not configured."
        : null,
  }));

  const buildAuthBffUrl = useCallback(
    (path: string) => {
      if (!authBffBase) {
        return path;
      }
      return `${authBffBase}${path}`;
    },
    [authBffBase],
  );

  const checkAuthStatus = useCallback(async () => {
    if (!loginRequired) {
      setState({
        user: null,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return;
    }

    if (!authBffBase) {
      setState({
        user: null,
        isAuthenticated: false,
        loading: false,
        error:
          "Enterprise login is enabled but VITE_AUTH_BFF_URL is not configured.",
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const response = await fetch(buildAuthBffUrl("/me"), {
        method: "GET",
        credentials: "include",
        mode: "cors",
      });

      if (response.ok) {
        const data = await response.json();
        setState({
          user: data.user ?? null,
          isAuthenticated: true,
          loading: false,
          error: null,
        });
        return;
      }

      if (response.status === 401) {
        setState({
          user: null,
          isAuthenticated: false,
          loading: false,
          error: null,
        });
        return;
      }

      const message =
        (await response.text()) ||
        "Authentication check failed. Please try again.";
      setState({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: message,
      });
    } catch (error) {
      setState({
        user: null,
        isAuthenticated: false,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Authentication check failed. Please try again.",
      });
    }
  }, [authBffBase, buildAuthBffUrl, loginRequired]);

  useEffect(() => {
    if (!loginRequired) {
      setState({
        user: null,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return;
    }

    checkAuthStatus();
  }, [checkAuthStatus, loginRequired]);

  const login = useCallback(
    (redirectUri?: string) => {
      if (!loginRequired || !authBffBase) {
        console.error(
          "Enterprise login is enabled but auth BFF URL is not configured.",
        );
        return;
      }

      if (typeof window === "undefined") return;

      const target = redirectUri || window.location.href;
      const loginUrl = `${buildAuthBffUrl(
        "/login",
      )}?redirect_uri=${encodeURIComponent(target)}`;
      window.location.href = loginUrl;
    },
    [authBffBase, buildAuthBffUrl, loginRequired],
  );

  const logout = useCallback(() => {
    if (!loginRequired || !authBffBase) {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      return;
    }

    if (typeof window === "undefined") return;

    const target = window.location.href;
    const logoutUrl = `${buildAuthBffUrl("/logout")}?redirect_uri=${encodeURIComponent(target)}`;
    window.location.href = logoutUrl;
  }, [authBffBase, buildAuthBffUrl, loginRequired]);

  const refresh = useCallback(async () => {
    if (!loginRequired || !authBffBase) {
      return;
    }

    await checkAuthStatus();
  }, [authBffBase, checkAuthStatus, loginRequired]);

  const stableValue = useMemo(
    () => ({ loginRequired, login, logout, refresh }),
    [loginRequired, login, logout, refresh],
  );
  const value: AuthContextValue = { ...state, ...stableValue };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
