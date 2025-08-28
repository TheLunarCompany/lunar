import { useCallback, useEffect, useReducer } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { getWebServerURL } from '@/config/api-config';

type ConnectionState = {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  disconnectError: string | null;
};

type ConnectionAction = 
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS' }
  | { type: 'CONNECT_ERROR'; error: string }
  | { type: 'DISCONNECT' }
  | { type: 'DISCONNECT_ERROR'; error: string };

const connectionReducer = (state: ConnectionState, action: ConnectionAction): ConnectionState => {
  switch (action.type) {
    case 'CONNECT_START':
      return { isConnecting: true, isConnected: false, error: null, disconnectError: null };
    case 'CONNECT_SUCCESS':
      return { isConnecting: false, isConnected: true, error: null, disconnectError: null };
    case 'CONNECT_ERROR':
      return { isConnecting: false, isConnected: false, error: action.error, disconnectError: null };
    case 'DISCONNECT':
      return { isConnecting: false, isConnected: false, error: null, disconnectError: null };
    case 'DISCONNECT_ERROR':
      return { isConnecting: false, isConnected: true, error: null, disconnectError: action.error };
    default:
      return state;
  }
};

export function useMcpxConnection() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [state, dispatch] = useReducer(connectionReducer, {
    isConnecting: false,
    isConnected: false,
    error: null,
    disconnectError: null
  });

  const connect = useCallback(async () => {
    if (!isAuthenticated || state.isConnecting) return false;
    
    dispatch({ type: 'CONNECT_START' });
    
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${getWebServerURL('http')}/auth/mcpx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ token })
      });
      
      if (response.ok) {
        dispatch({ type: 'CONNECT_SUCCESS' });
        return true;
      } else {
        dispatch({ type: 'CONNECT_ERROR', error: `Connection failed: ${response.status}` });
        return false;
      }
    } catch (error) {
      dispatch({ type: 'CONNECT_ERROR', error: `Connection error: ${error}` });
      return false;
    }
  }, [isAuthenticated, state.isConnecting, getAccessTokenSilently]);

  const disconnect = useCallback(async () => {
    if (!state.isConnected) return;
    
    try {
      await fetch(`${getWebServerURL('http')}/auth/mcpx`, {
        method: 'DELETE'
      });
      dispatch({ type: 'DISCONNECT' });
    } catch (error) {
      dispatch({ type: 'DISCONNECT_ERROR', error: `Disconnect failed: ${error}` });
    }
  }, [state.isConnected]);

  useEffect(() => {
    if (isAuthenticated && !state.isConnected && !state.isConnecting) {
      connect();
    } else if (!isAuthenticated && state.isConnected) {
      disconnect();
    }
  }, [isAuthenticated, state.isConnected, state.isConnecting, connect, disconnect]);

  return {
    ...state,
    connectionError: state.error,
    disconnectError: state.disconnectError
  };
}
