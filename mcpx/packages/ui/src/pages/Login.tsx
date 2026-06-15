import { useEffect } from "react";
import { useAuth } from "@/contexts/useAuth";

export function LoginRoute() {
  const { login, loading, error, loginRequired, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loginRequired || isAuthenticated) return;
    login();
  }, [isAuthenticated, login, loginRequired]);

  if (!loginRequired) {
    return <div>Login is disabled for this environment.</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-md rounded-lg p-6 text-center space-y-3">
        <p className="text-lg font-semibold text-gray-900">
          Redirecting to sign in...
        </p>
        {loading && (
          <span className="inline-block h-5 w-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
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
