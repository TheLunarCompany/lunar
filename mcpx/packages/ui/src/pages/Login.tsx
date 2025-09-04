import { useAuth0 } from "@auth0/auth0-react";
import React from "react";

export function LoginRoute() {
  const { loginWithRedirect } = useAuth0();
  
  React.useEffect(() => {
    loginWithRedirect({
      authorizationParams: {
        prompt: 'login',
        screen_hint: 'login',
      },
    });
  }, [loginWithRedirect]);
  
  return <div>Redirecting to login...</div>;
}

export function LogoutRoute() {
  const { logout } = useAuth0();
  
  React.useEffect(() => {
    // Clear Auth0 cache from localStorage to force fresh login
    localStorage.removeItem('auth0.is.authenticated');
    localStorage.removeItem('auth0.is.authenticated.updated_at');
    
    logout({
      openUrl() {
        window.location.replace('/');
      },
    });
  }, [logout]);
  
  return <div>Logging out...</div>;
}