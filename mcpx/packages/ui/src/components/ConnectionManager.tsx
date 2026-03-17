import { useEffect } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useSocketStore } from "@/store";

export function ConnectionManager() {
  const { loginRequired, isAuthenticated } = useAuth();
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);

  useEffect(() => {
    // If enterprise is enabled (loginRequired), we wait for authentication
    if (loginRequired && !isAuthenticated) {
      disconnect();
      return;
    }

    // Connect if not enterprise (local) or if authenticated enterprise user
    connect();

    return () => {
      disconnect();
    };
  }, [loginRequired, isAuthenticated, connect, disconnect]);

  return null;
}
