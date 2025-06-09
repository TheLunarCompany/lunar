import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import {
  ClientBoundMessage,
  ServerBoundMessage,
  type McpxInstance,
} from "@mcpx/shared-model";

type SocketStore = {
  isConnected: boolean;
  systemState: McpxInstance | null;
  connect: () => void;
};

export const socketStore = create<SocketStore>((set, get) => {
  let socket: Socket | undefined = undefined;

  return { isConnected: false, systemState: null, connect, emitGetSystemState };

  function listen() {
    socket?.on("connect", () => {
      set({ isConnected: true });
      emitGetSystemState();
    });

    socket?.on("disconnect", () => {
      set({ isConnected: true });
    });

    socket?.on("connect_failed", () => {
      console.error("Connection failed");
    });

    socket?.on("connect_error", (error) => {
      console.error("Connection error", error.message);
    });

    socket?.on(ClientBoundMessage.SystemState, (payload: McpxInstance) => {
      set({ systemState: payload });
    });
  }

  function emitGetSystemState() {
    socket?.emit(ServerBoundMessage.GetSystemState);
  }

  function connect(token: string = "") {
    const url = import.meta.env.VITE_WS_URL || "http://localhost:9001"; // TODO: Make reading from env work

    socket = io(url, { auth: { token } });

    socket.connect();

    listen();
  }
});
