// Unified websocket messages for direct UI to MCPX server communication

import { z } from "zod/v4";

// Connection error messages (used in socket.io middleware rejection)
export const WS_CONNECTION_ERROR = {
  HUB_NOT_CONNECTED: "Hub not connected",
} as const;

// Messages from UI to MCPX server.
export enum UI_ServerBoundMessage {
  GetAppConfig = "getAppConfig",
  GetSystemState = "getSystemState",
  SetDynamicCapabilities = "setDynamicCapabilities",
}

export const setDynamicCapabilitiesPayloadSchema = z.object({
  sessionIds: z.array(z.string()),
  enabled: z.boolean(),
});
export type SetDynamicCapabilitiesPayload = z.infer<
  typeof setDynamicCapabilitiesPayloadSchema
>;

// Messages from MCPX server to UI
export enum UI_ClientBoundMessage {
  AppConfig = "appConfig",
  GetAppConfigFailed = "getAppConfigFailed",

  SystemState = "systemState",
  GetSystemStateFailed = "getSystemStateFailed",

  IdentityChanged = "identityChanged",
}
