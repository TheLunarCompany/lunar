import {
  RemoteTargetServer,
  StdioTargetServer,
  TargetServer,
} from "../model/target-servers.js";
import { ExtendedClientI } from "./client-extension.js";
import { MissingEnvVar } from "../errors.js";

export interface ConnectedTargetClient {
  _state: "connected";
  targetServer: TargetServer;
  extendedClient: ExtendedClientI;
}

export interface PendingAuthTargetClient {
  _state: "pending-auth";
  targetServer: RemoteTargetServer;
}

export interface PendingInputTargetClient {
  _state: "pending-input";
  targetServer: StdioTargetServer;
  missingEnvVars: MissingEnvVar[];
}

export interface ConnectionFailedTargetClient {
  _state: "connection-failed";
  targetServer: TargetServer;
  error: Error;
}

export interface ConnectingTargetClient {
  _state: "connecting";
  targetServer: TargetServer;
}

export type TargetClient =
  | ConnectingTargetClient
  | ConnectedTargetClient
  | PendingAuthTargetClient
  | PendingInputTargetClient
  | ConnectionFailedTargetClient;
