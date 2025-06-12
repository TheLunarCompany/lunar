import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { io, type Socket } from "socket.io-client";
import {
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
  type SystemState,
} from "@mcpx/shared-model";

type SocketStore = {
  isConnected: boolean;
  systemState: SystemState | null;
  connect: () => void;
};

export const socketStore = create<SocketStore>((set, get) => {
  let socket: Socket | undefined = undefined;

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

    socket?.on(UI_ClientBoundMessage.SystemState, (payload: SystemState) => {
      set({ systemState: payload });
    });
  }

  function connect(token: string = "") {
    const url = import.meta.env.VITE_WS_URL || "http://localhost:9001"; // TODO: Make reading from env work

    socket = io(url, { auth: { token }, path: "/ws-ui" });

    socket.connect();

    listen();
  }

  function emitGetSystemState() {
    socket?.emit(UI_ServerBoundMessage.GetSystemState);
  }

  function emitSetSystemState() {
    // socket?.emit(UI_ServerBoundMessage.SetSystemState);
  }

  return {
    connect,
    emitGetSystemState,
    emitSetSystemState,
    isConnected: false,
    systemState: null,
  };
});

export const useSocketStore = <T>(selector: (state: SocketStore) => T) =>
  socketStore(useShallow(selector));
