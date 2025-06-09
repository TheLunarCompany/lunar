export enum ServerBoundMessage {
  GetSystemState = "getSystemState",
}

export enum ClientBoundMessage {
  SystemState = "systemState",
  GetSystemStateFailed = "getSystemStateFailed",
}
