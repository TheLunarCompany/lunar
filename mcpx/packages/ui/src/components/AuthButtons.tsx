import React from "react";
import { useMcpxConnection } from "@/hooks/useMcpxConnection";
import { useAuth } from "@/contexts/useAuth";

export function AuthButtons() {
  const {
    isAuthenticated,
    user,
    loading: isLoading,
    login,
    logout,
    loginRequired,
  } = useAuth();
  const [, setIsLoggingOut] = React.useState(false);

  // Use the MCPX connection hook
  const { connectionError } = useMcpxConnection();

  const isLoginEnabled = loginRequired;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 bg-gray-100 border-b">
        <span className="text-gray-600">Loading authentication...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (!isLoginEnabled) {
      return null;
    }

    return (
      <div className="flex items-center justify-center p-4 bg-blue-50 border-b">
        <button
          onClick={() => {
            login();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-green-50 border-b">
      <span className="text-gray-700">
        Welcome,{" "}
        <span className="font-semibold">{user?.email || user?.name}</span>!
      </span>

      <div className="flex items-center gap-2">
        {connectionError && (
          <span className="text-red-600 text-sm">{connectionError}</span>
        )}
      </div>

      <button
        onClick={() => {
          setIsLoggingOut(true);
          logout();
        }}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        Logout
      </button>
    </div>
  );
}
