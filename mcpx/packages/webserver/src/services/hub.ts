import {
  ApplyParsedAppConfigRequest,
  WebserverToMCPXMessage,
  TargetServerName,
  TargetServerRequest,
} from "@mcpx/shared-model";
import { logger } from "../logger.js";
import { Connections } from "./connections.js";

// This type defines expected payloads for messages sent to the MCPX server over WS.
type Message =
  | { name: WebserverToMCPXMessage.GetSystemState; payload: null }
  | { name: WebserverToMCPXMessage.GetAppConfig; payload: null }
  | {
      name: WebserverToMCPXMessage.PatchAppConfig;
      payload: ApplyParsedAppConfigRequest;
    }
  | {
      name: WebserverToMCPXMessage.AddTargetServer;
      payload: TargetServerRequest;
    }
  | {
      name: WebserverToMCPXMessage.UpdateTargetServer;
      payload: TargetServerRequest;
    }
  | {
      name: WebserverToMCPXMessage.RemoveTargetServer;
      payload: TargetServerName;
    };

export class Hub {
  private _connections: Connections;
  constructor(connections: Connections) {
    this._connections = connections;
  }

  send(message: Message): void {
    if (!this._connections.mcpxSocket) {
      const error = new Error(
        "MCPX socket is not connected, cannot send message",
      );
      logger.error(error.message);
      throw error;
    }

    this._connections.mcpxSocket.emit(message.name, message.payload);
  }
}
