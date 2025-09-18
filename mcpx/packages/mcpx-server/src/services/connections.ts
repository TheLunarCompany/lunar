import { Socket } from "socket.io";

export class UIConnections {
  private _uiSocket: Socket | null = null;

  get uiSocket(): Socket | null {
    return this._uiSocket;
  }

  set uiSocket(socket: Socket | null) {
    this._uiSocket?.disconnect(true);
    this._uiSocket = socket;
  }

  shutdown(): void {
    this._uiSocket?.disconnect(true);
    this._uiSocket = null;
  }
}
