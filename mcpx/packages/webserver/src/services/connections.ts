import { Socket } from "socket.io";

export class Connections {
  uiSocket: Socket | null = null;
  mcpxSocket: Socket | null = null;
}
