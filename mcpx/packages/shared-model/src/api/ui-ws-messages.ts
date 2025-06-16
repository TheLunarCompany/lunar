// Messages from UI to webserver
export enum UI_ServerBoundMessage {
  GetSystemState = "getSystemState",
}

// Messages from webserver to UI
export enum UI_ClientBoundMessage {
  SystemState = "systemState",
  GetSystemStateFailed = "getSystemStateFailed",
}
