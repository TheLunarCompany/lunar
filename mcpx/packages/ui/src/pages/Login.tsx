import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { routes } from "@/routes";

export function LoginRoute() {
  const { login, loading, error, loginRequired, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loginRequired) {
      return;
    }
    if (isAuthenticated) {
      void navigate(routes.root, { replace: true });
      return;
    }
    login();
  }, [isAuthenticated, login, loginRequired, navigate]);

  if (!loginRequired) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-mcpx-page p-6">
        <div className="w-full max-w-md rounded-xl border border-mcpx-border bg-mcpx-surface p-8 text-center shadow-[var(--mcpx-shadow-weak)]">
          <h1 className="mcpx-page-title">Login is disabled</h1>
          <p className="mt-2 text-sm text-mcpx-text-secondary">
            This environment does not require authentication.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mcpx-page">
      <div className="space-y-3 rounded-lg bg-mcpx-surface p-6 text-center shadow-[var(--mcpx-shadow-moderate)]">
        <p className="text-lg font-semibold text-mcpx-text">
          Redirecting to sign in...
        </p>
        {loading && (
          <span className="inline-block size-5 animate-spin rounded-full border-2 border-mcpx-border border-t-transparent" />
        )}
        {error && <p className="text-sm text-mcpx-danger-text">{error}</p>}
      </div>
    </div>
  );
}

export function LogoutRoute() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, [logout]);

  return <div>Logging out...</div>;
}
