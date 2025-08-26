// Messages from MCPX to webserver
export enum MCPXToWebserverMessage {
  SystemState = "systemState",
  GetSystemStateFailed = "getSystemStateFailed",

  AppConfig = "appConfig",
  GetAppConfigFailed = "getAppConfigFailed",
  PatchAppConfigFailed = "patchAppConfigFailed",

  TargetServerAdded = "targetServerAdded",
  AddTargetServerFailed = "addTargetServerFailed",

  TargetServerRemoved = "targetServerRemoved",
  RemoveTargetServerFailed = "removeTargetServerFailed",

  TargetServerUpdated = "targetServerUpdated",
  UpdateTargetServerFailed = "updateTargetServerFailed",
}

// Messages from webserver to MCPX
export enum WebserverToMCPXMessage {
  GetSystemState = "getSystemState",

  GetAppConfig = "getAppConfig",
  PatchAppConfig = "patchAppConfig",

  AddTargetServer = "addTargetServer",
  RemoveTargetServer = "removeTargetServer",
  UpdateTargetServer = "updateTargetServer",
}
