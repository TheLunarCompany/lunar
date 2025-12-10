// Unified websocket messages for direct UI to MCPX server communication

// Messages from UI to MCPX server
export enum UI_ServerBoundMessage {
  GetAppConfig = "getAppConfig",
  GetSystemState = "getSystemState",
  PatchAppConfig = "patchAppConfig",
  AddTargetServer = "addTargetServer",
  RemoveTargetServer = "removeTargetServer",
  UpdateTargetServer = "updateTargetServer",
}

// Messages from MCPX server to UI
export enum UI_ClientBoundMessage {
  AppConfig = "appConfig",
  GetAppConfigFailed = "getAppConfigFailed",
  PatchAppConfigFailed = "patchAppConfigFailed",

  SystemState = "systemState",
  GetSystemStateFailed = "getSystemStateFailed",

  TargetServerAdded = "targetServerAdded",
  AddTargetServerFailed = "addTargetServerFailed",

  TargetServerRemoved = "targetServerRemoved",
  RemoveTargetServerFailed = "removeTargetServerFailed",

  TargetServerUpdated = "targetServerUpdated",
  UpdateTargetServerFailed = "updateTargetServerFailed",
}
