import {
  AppConfig,
  appConfigSchema,
  SerializedAppConfig,
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
  type SystemState,
} from "@mcpx/shared-model";
import { io, type Socket } from "socket.io-client";
import YAML from "yaml";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export type SocketStore = {
  appConfig: AppConfig | null;
  serializedAppConfig: SerializedAppConfig | null;
  isConnected: boolean;
  systemState: SystemState | null;
  connect: () => void;
};

export const socketStore = create<SocketStore>((set, get) => {
  let socket: Socket | undefined = undefined;

  function listen() {
    socket?.on("connect", () => {
      set({ isConnected: true });
      emitGetAppConfig();
      emitGetSystemState();
    });

    socket?.on("disconnect", () => {
      set({ isConnected: false });
    });

    socket?.on("connect_failed", () => {
      console.error("Connection failed");
    });

    socket?.on("connect_error", (error) => {
      console.error("Connection error", error.message);
    });

    socket?.on(
      UI_ClientBoundMessage.AppConfig,
      (payload: SerializedAppConfig) => {
        try {
          const parsedAppConfig = appConfigSchema.parse(
            YAML.parse(payload.yaml),
          );
          set({
            appConfig: parsedAppConfig,
            serializedAppConfig: payload,
          });
        } catch (error) {
          console.error("Failed to parse app config", error);
          set({ appConfig: null });
        }
      },
    );

    socket?.on(UI_ClientBoundMessage.SystemState, (payload: SystemState) => {
      set({ systemState: payload });
    });
  }

  function connect(token: string = "") {
    const url = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:9001";

    socket = io(url, { auth: { token }, path: "/ws-ui" });

    socket.connect();

    listen();
  }

  function emitGetAppConfig() {
    socket?.emit(UI_ServerBoundMessage.GetAppConfig);
  }

  function emitGetSystemState() {
    socket?.emit(UI_ServerBoundMessage.GetSystemState);
  }

  return {
    appConfig: null,
    serializedAppConfig: null,
    connect,
    emitGetSystemState,
    isConnected: false,
    systemState: null,
  };
});

export const useSocketStore = <T>(selector: (state: SocketStore) => T) =>
  socketStore(useShallow(selector));
