import { Socket } from "socket.io";
import { Logger } from "winston";

export class UIConnection {
  private _socket: Socket;
  private _cleanupSystemState: () => void;
  private _cleanAppConfig: () => void;

  constructor(
    socket: Socket,
    systemStateCallback: () => void,
    appConfigCallback: () => void,
  ) {
    this._socket = socket;
    this._cleanupSystemState = systemStateCallback;
    this._cleanAppConfig = appConfigCallback;
  }

  get socket(): Socket {
    return this._socket;
  }

  disconnect(): void {
    this._cleanupSystemState();
    this._cleanAppConfig();
    this._socket.disconnect(true);
  }
}

export class UIConnections {
  private uiSessions = new Map<string, UIConnection>();

  constructor(private logger: Logger) {}

  addSession(connection: UIConnection): void {
    this.uiSessions.set(connection.socket.id, connection);
  }

  removeSession(socketId: string): void {
    const connection = this.uiSessions.get(socketId);
    if (!connection) {
      return;
    }
    connection.disconnect();
    this.uiSessions.delete(socketId);
  }

  getSessionIds(): string[] {
    return Array.from(this.uiSessions.keys());
  }

  size(): number {
    return this.uiSessions.size;
  }

  shutdown(): void {
    for (const connection of this.uiSessions.values()) {
      try {
        connection.socket.disconnect(true);
      } catch {
        this.logger.debug("Failed to disconnect socket", {
          socketId: connection.socket.id,
        });
      }
    }
    this.uiSessions.clear();
  }
}
