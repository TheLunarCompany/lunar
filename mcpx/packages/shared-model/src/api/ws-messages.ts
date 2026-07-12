// Unified websocket messages for direct UI to MCPX server communication

// Connection error messages (used in socket.io middleware rejection)
export const WS_CONNECTION_ERROR = {
  HUB_NOT_CONNECTED: "Hub not connected",
} as const;

// Messages from UI to MCPX server. Read- and push-only: writes go over REST.
export enum UI_ServerBoundMessage {
  GetAppConfig = "getAppConfig",
  GetSystemState = "getSystemState",
}

// Messages from MCPX server to UI
export enum UI_ClientBoundMessage {
  AppConfig = "appConfig",
  GetAppConfigFailed = "getAppConfigFailed",

  SystemState = "systemState",
  GetSystemStateFailed = "getSystemStateFailed",

  IdentityChanged = "identityChanged",
}
