import { useCallback, useEffect, useReducer } from "react";
import { getMcpxServerURL } from "@/config/api-config";
import { useAuth } from "@/contexts/useAuth";

type ConnectionState = {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  disconnectError: string | null;
};

type ConnectionAction =
  | { type: "CONNECT_START" }
  | { type: "CONNECT_SUCCESS" }
  | { type: "CONNECT_ERROR"; error: string }
  | { type: "DISCONNECT" }
  | { type: "DISCONNECT_ERROR"; error: string };

const connectionReducer = (
  state: ConnectionState,
  action: ConnectionAction,
): ConnectionState => {
  switch (action.type) {
    case "CONNECT_START":
      return {
        isConnecting: true,
        isConnected: false,
        error: null,
        disconnectError: null,
      };
    case "CONNECT_SUCCESS":
      return {
        isConnecting: false,
        isConnected: true,
        error: null,
        disconnectError: null,
      };
    case "CONNECT_ERROR":
      return {
        isConnecting: false,
        isConnected: false,
        error: action.error,
        disconnectError: null,
      };
    case "DISCONNECT":
      return {
        isConnecting: false,
        isConnected: false,
        error: null,
        disconnectError: null,
      };
    case "DISCONNECT_ERROR":
      return {
        isConnecting: false,
        isConnected: true,
        error: null,
        disconnectError: action.error,
      };
    default:
      return state;
  }
};

export function useMcpxConnection(enabled: boolean = true) {
  const {
    loginRequired,
    isAuthenticated: isUserAuthenticated,
    loading: authLoading,
  } = useAuth();
  const shouldDelayConnection =
    !enabled || (loginRequired && (authLoading || !isUserAuthenticated));

  const [state, dispatch] = useReducer(connectionReducer, {
    isConnecting: false,
    isConnected: false,
    error: null,
    disconnectError: null,
  });

  const connect = useCallback(async () => {
    if (!enabled) return false;
    if (shouldDelayConnection || state.isConnecting || state.isConnected) {
      return false;
    }

    dispatch({ type: "CONNECT_START" });

    try {
      const response = await fetch(`${getMcpxServerURL("http")}/auth/mcpx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: loginRequired ? "include" : "same-origin",
        body: JSON.stringify({}),
      });

      if (response.ok) {
        dispatch({ type: "CONNECT_SUCCESS" });
        return true;
      } else {
        dispatch({
          type: "CONNECT_ERROR",
          error: `Connection failed: ${response.status}`,
        });
        return false;
      }
    } catch (error) {
      dispatch({ type: "CONNECT_ERROR", error: `Connection error: ${error}` });
      return false;
    }
  }, [
    enabled,
    shouldDelayConnection,
    state.isConnecting,
    state.isConnected,
    loginRequired,
  ]);

  const disconnect = useCallback(async () => {
    if (!enabled) return;
    if (!state.isConnected) return;

    try {
      await fetch(`${getMcpxServerURL("http")}/auth/mcpx`, {
        method: "DELETE",
        credentials: loginRequired ? "include" : "same-origin",
      });
      dispatch({ type: "DISCONNECT" });
    } catch (error) {
      dispatch({
        type: "DISCONNECT_ERROR",
        error: `Disconnect failed: ${error}`,
      });
    }
  }, [enabled, state.isConnected, loginRequired]);

  useEffect(() => {
    if (
      enabled &&
      !shouldDelayConnection &&
      !state.isConnected &&
      !state.isConnecting
    ) {
      void connect();
    } else if (state.isConnected && (shouldDelayConnection || !enabled)) {
      void disconnect();
    }
  }, [
    enabled,
    shouldDelayConnection,
    state.isConnected,
    state.isConnecting,
    connect,
    disconnect,
  ]);

  return {
    ...state,
    connectionError: state.error,
    disconnectError: state.disconnectError,
  };
}
