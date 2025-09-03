// Messages from UI to webserver
export enum UI_ServerBoundMessage {
  GetAppConfig = "getAppConfig",
  GetSystemState = "getSystemState",
}

// Messages from webserver to UI
export enum UI_ClientBoundMessage {
  AppConfig = "appConfig",
  GetAppConfigFailed = "getAppConfigFailed",
  GetSystemStateFailed = "getSystemStateFailed",
  SystemState = "systemState",
}
