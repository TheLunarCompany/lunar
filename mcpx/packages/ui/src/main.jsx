import React from "react";
import ReactDOM from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "@/App.js";
import "@/index.css";

const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'mcpx-webapp',
  },
  cacheLocation: 'localstorage',
  onRedirectCallback: (appState) => {
    // Auto-connect to MCPX after successful Auth0 login
    if (appState?.returnTo) {
      window.history.replaceState(
        {},
        document.title,
        appState.returnTo
      );
    }
  },
};

const isAuth0Enabled = import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID;

if (isAuth0Enabled) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <App />
  );
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={auth0Config.authorizationParams}
      cacheLocation={auth0Config.cacheLocation}
    >
      <App />
    </Auth0Provider>
  );
}
