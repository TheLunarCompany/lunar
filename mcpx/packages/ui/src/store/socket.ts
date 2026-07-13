import {
  AppConfig,
  appConfigSchema,
  SerializedAppConfig,
  type SystemState,
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
  WS_CONNECTION_ERROR,
} from "@mcpx/shared-model";
import { io, type Socket } from "socket.io-client";
import YAML from "yaml";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";
import { getMcpxServerURL } from "../config/api-config";
import { isEnterpriseEnabled } from "@/config/runtime-config";
import { createDevtoolsOptions } from "./devtools";
import { debounce } from "../utils";

export type SocketStore = {
  // Socket State
  appConfig: AppConfig | null;
  connectError: boolean;
  connectionRejectedHubRequired: boolean;
  isConnected: boolean;
  isPending: boolean;
  serializedAppConfig: SerializedAppConfig | null;
  systemState: SystemState | null;
  socket: Socket | null;

  // Socket Actions
  connect: (token?: string) => Promise<void>;
  disconnect: () => void;
};

function shouldSendCredentials(): boolean {
  return isEnterpriseEnabled();
}

export const socketStore = create<SocketStore>()(
  devtools(
    immer((set, get) => {
      let socket: Socket | null = null;
      let listenersBound = false;
      let pendingAppConfig = true;
      let pendingSystemState = true;

      const systemStateUpdate = (newState: SystemState) => {
        const clonedState = structuredClone(newState);
        set({ systemState: clonedState });
      };

      const debouncedSystemStateUpdate = debounce(systemStateUpdate, 1000);

      function setupEventListeners() {
        if (!socket || listenersBound) return;
        listenersBound = true;

        socket.on("disconnect", () => set({ isConnected: false }));
        socket.on("connect_failed", () =>
          set({ connectError: true, isConnected: false }),
        );

        socket.on(
          UI_ClientBoundMessage.AppConfig,
          (payload: SerializedAppConfig) => {
            const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            try {
              if (!payload.yaml) {
                const currentAppConfig = get().appConfig;
                console.warn(
                  "[Frontend] [Socket] Received AppConfig with undefined yaml field, keeping current appConfig",
                  {
                    eventId,
                    payload,
                    hasCurrentAppConfig: !!currentAppConfig,
                    payloadKeys: Object.keys(payload || {}),
                  },
                );
                set({ serializedAppConfig: payload });
                pendingAppConfig = false;
                if (!pendingSystemState && get().isPending)
                  set({ isPending: false });
                return;
              }

              const parsedAppConfig = appConfigSchema.parse(
                YAML.parse(payload.yaml),
              );

              set({ appConfig: parsedAppConfig, serializedAppConfig: payload });
            } catch {
              set({ serializedAppConfig: payload });
            }
            pendingAppConfig = false;
            if (!pendingSystemState && get().isPending)
              set({ isPending: false });
          },
        );

        socket.on(UI_ClientBoundMessage.SystemState, (payload: SystemState) => {
          // In test mode, ignore real socket updates to prevent overwriting mocks
          if (typeof window !== "undefined" && window.__MCPX_TEST_MODE__) {
            return;
          }

          const currentState = get().systemState;
          pendingSystemState = false;
          if (!currentState) {
            set({ systemState: payload });
            if (!pendingAppConfig && get().isPending) set({ isPending: false });
          } else {
            debouncedSystemStateUpdate(payload);
          }
        });
      }

      let isConnecting = false;

      async function connect(token: string = "") {
        if (socket?.connected) return;

        isConnecting = true;
        set({ isPending: true, connectError: false });
        pendingAppConfig = true;
        pendingSystemState = true;

        // In enterprise mode, poll until the backend is ready
        if (isEnterpriseEnabled()) {
          const wsPollUrl = `${getMcpxServerURL("http")}/ws-ui/?EIO=4&transport=polling`;
          const authPollUrl = `${getMcpxServerURL("http")}/auth/mcpx`;

          while (isConnecting) {
            try {
              const fetchOptions: RequestInit = {
                method: "GET",
                credentials: shouldSendCredentials()
                  ? "include"
                  : "same-origin",
              };

              const [wsResponse, authResponse] = await Promise.all([
                fetch(wsPollUrl, fetchOptions),
                fetch(authPollUrl, fetchOptions),
              ]);

              if (wsResponse.ok && authResponse.ok) {
                break;
              }
            } catch {
              // Ignore errors and retry
            }
            // Wait 1 second before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          // If we stopped connecting (e.g. disconnect called), don't proceed
          if (!isConnecting) return;
        }

        const url = getMcpxServerURL("ws");
        socket = io(url, {
          auth: { token },
          path: "/ws-ui",
          transports: ["polling", "websocket"],
          upgrade: true,
          reconnection: true,
          reconnectionAttempts: Infinity,
          timeout: 20000,
          withCredentials: shouldSendCredentials(),
        });

        set({ socket });

        socket.on("connect", () => {
          set({ isConnected: true, connectError: false, isPending: false });
          // Only reset isConnecting after successful connection
          isConnecting = false;
          emitGetAppConfig();
          emitGetSystemState();
        });

        socket.on("connect_error", (error) => {
          console.error("WebSocket connection error:", error);
          if (error.message === WS_CONNECTION_ERROR.HUB_NOT_CONNECTED) {
            set({
              connectionRejectedHubRequired: true,
              isConnected: false,
              isPending: false,
            });
          } else {
            set({ connectError: true, isConnected: false, isPending: false });
          }
        });

        socket.on("reconnect", () => {
          set({ isConnected: true, connectError: false, isPending: false });
          emitGetAppConfig();
          emitGetSystemState();
        });

        socket.on("reconnect_error", (error) => {
          console.error("WebSocket reconnection error:", error);
          set({ connectError: true, isConnected: false, isPending: false });
        });

        socket.on("reconnect_failed", () => {
          console.error("WebSocket reconnection failed");
          set({ connectError: true, isConnected: false, isPending: false });
        });

        setupEventListeners();
        // Note: socket.io-client connects automatically by default unless { autoConnect: false }
        // But explicit connect doesn't hurt if we want to be sure
        if (!socket.connected) {
          socket.connect();
        }
      }

      function removeEventListeners() {
        if (!socket || !listenersBound) return;
        listenersBound = false;

        socket.off("disconnect");
        socket.off("connect_failed");

        socket.off(UI_ClientBoundMessage.AppConfig);
        socket.off(UI_ClientBoundMessage.SystemState);
      }

      function disconnect() {
        if (socket) {
          removeEventListeners();
          socket.disconnect();
          socket = null;
        }
        set({ isConnected: false, connectError: false, isPending: false });
      }

      function safeEmit(message: UI_ServerBoundMessage, data?: unknown) {
        if (!socket?.connected) {
          throw new Error("WebSocket not connected");
        }
        socket.emit(message, data);
      }

      function emitGetAppConfig() {
        safeEmit(UI_ServerBoundMessage.GetAppConfig);
      }

      function emitGetSystemState() {
        safeEmit(UI_ServerBoundMessage.GetSystemState);
      }

      return {
        appConfig: null,
        connect,
        disconnect,
        connectError: false,
        connectionRejectedHubRequired: false,
        isConnected: false,
        isPending: true,
        serializedAppConfig: null,
        socket: null, // This will be updated when connect() is called
        systemState: null,
      };
    }),
    createDevtoolsOptions("socket"),
  ),
);

export const useSocketStore = <T>(selector: (state: SocketStore) => T) =>
  socketStore(useShallow(selector));

// Expose store to window for E2E testing
if (typeof window !== "undefined") {
  window.__MCPX_SOCKET_STORE__ = socketStore;
}
