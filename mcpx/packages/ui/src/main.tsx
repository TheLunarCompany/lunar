import React from "react";
import ReactDOM from "react-dom/client";
import { Auth0Provider, AppState } from "@auth0/auth0-react";
import { Auth0ClientOptions } from "@auth0/auth0-spa-js";
import App from "@/App";
import "@/index.css";
import {
  loadRuntimeConfig,
  getRuntimeConfigSync,
} from "@/config/runtime-config";

// Load runtime config immediately
loadRuntimeConfig().catch(() => {});

interface Auth0Config extends Auth0ClientOptions {
  domain: string;
  clientId: string;
  authorizationParams: {
    redirect_uri: string;
    audience: string;
  };
  cacheLocation: "localstorage";
  onRedirectCallback: (appState?: AppState) => void;
}

const runtimeConfig = getRuntimeConfigSync();

const auth0Config: Auth0Config = {
  domain:
    runtimeConfig.VITE_AUTH0_DOMAIN || import.meta.env.VITE_AUTH0_DOMAIN || "",
  clientId:
    runtimeConfig.VITE_AUTH0_CLIENT_ID ||
    import.meta.env.VITE_AUTH0_CLIENT_ID ||
    "",
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience:
      runtimeConfig.VITE_AUTH0_AUDIENCE ||
      import.meta.env.VITE_AUTH0_AUDIENCE ||
      "mcpx-webapp",
  },
  cacheLocation: "localstorage",
  onRedirectCallback: (appState?: AppState) => {
    // Auto-connect to MCPX after successful Auth0 login
    if (appState?.returnTo) {
      window.history.replaceState({}, document.title, appState.returnTo);
    }
  },
};

const isAuth0Enabled: boolean =
  Boolean(
    runtimeConfig.VITE_AUTH0_DOMAIN || import.meta.env.VITE_AUTH0_DOMAIN,
  ) &&
  Boolean(
    runtimeConfig.VITE_AUTH0_CLIENT_ID || import.meta.env.VITE_AUTH0_CLIENT_ID,
  );

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);

if (isAuth0Enabled) {
  root.render(
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={auth0Config.authorizationParams}
      cacheLocation={auth0Config.cacheLocation}
      onRedirectCallback={auth0Config.onRedirectCallback}
    >
      <App />
    </Auth0Provider>,
  );
} else {
  root.render(<App />);
}
