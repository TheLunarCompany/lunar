import {
  AppConfig,
  appConfigSchema,
  ApplyParsedAppConfigRequest,
  RawCreateTargetServerRequest,
  RawUpdateTargetServerRequest,
  SerializedAppConfig,
  type SystemState,
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
} from "@mcpx/shared-model";
import { io, type Socket } from "socket.io-client";
import YAML from "yaml";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";
import { getMcpxServerURL } from "../config/api-config";
import { debounce } from "../utils";

class ResponseHandler {
  private handlers = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: unknown) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  createPromise<T>(operationId: string, timeoutMs: number = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.handlers.delete(operationId);
        reject(new Error(`Operation ${operationId} timed out`));
      }, timeoutMs);

      this.handlers.set(operationId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
    });
  }

  resolve(operationId: string, value: unknown): void {
    const handler = this.handlers.get(operationId);
    if (handler) {
      clearTimeout(handler.timeout);
      this.handlers.delete(operationId);
      handler.resolve(value);
    }
  }

  reject(operationId: string, error: unknown): void {
    const handler = this.handlers.get(operationId);
    if (handler) {
      clearTimeout(handler.timeout);
      this.handlers.delete(operationId);
      handler.reject(error);
    }
  }

  cleanup(): void {
    this.handlers.forEach(({ timeout }) => clearTimeout(timeout));
    this.handlers.clear();
  }
}

export type SocketStore = {
  // Socket State
  appConfig: AppConfig | null;
  connectError: boolean;
  isConnected: boolean;
  isPending: boolean;
  serializedAppConfig: SerializedAppConfig | null;
  systemState: SystemState | null;
  socket: Socket | null;

  // Socket Actions
  connect: () => void;
  disconnect: () => void;
  emitPatchAppConfig: (
    config: ApplyParsedAppConfigRequest,
  ) => Promise<SerializedAppConfig>;
  emitAddTargetServer: (
    server: RawCreateTargetServerRequest,
  ) => Promise<SerializedAppConfig>;
  emitRemoveTargetServer: (name: string) => Promise<SerializedAppConfig>;
  emitUpdateTargetServer: (
    name: string,
    data: RawUpdateTargetServerRequest,
  ) => Promise<SerializedAppConfig>;
};

export const socketStore = create<SocketStore>()(
  immer((set, get) => {
    let socket: Socket | null = null;
    const responseHandler = new ResponseHandler();
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
              responseHandler.resolve("patchAppConfig", payload);
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
          if (!pendingSystemState && get().isPending) set({ isPending: false });
          responseHandler.resolve("patchAppConfig", payload);
        },
      );

      socket.on(
        UI_ClientBoundMessage.PatchAppConfigFailed,
        (payload: { error?: string }) => {
          const errorMessage = payload?.error || "Failed to patch app config";
          console.error(
            "[Socket] PatchAppConfig failed:",
            errorMessage,
            payload,
          );
          responseHandler.reject("patchAppConfig", new Error(errorMessage));
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

      socket.on(
        UI_ClientBoundMessage.TargetServerAdded,
        (payload: SerializedAppConfig) => {
          responseHandler.resolve("addTargetServer", payload);
          emitGetSystemState();
        },
      );

      socket.on(
        UI_ClientBoundMessage.TargetServerRemoved,
        (payload: SerializedAppConfig) => {
          responseHandler.resolve("removeTargetServer", payload);
          emitGetSystemState();
        },
      );

      socket.on(
        UI_ClientBoundMessage.TargetServerUpdated,
        (payload: SerializedAppConfig) => {
          responseHandler.resolve("updateTargetServer", payload);
          emitGetSystemState();
        },
      );

      socket.on(
        UI_ClientBoundMessage.AddTargetServerFailed,
        (payload: { error?: string }) => {
          responseHandler.reject(
            "addTargetServer",
            new Error(payload.error || "Failed to add target server"),
          );
        },
      );

      socket.on(
        UI_ClientBoundMessage.RemoveTargetServerFailed,
        (payload: { error?: string }) => {
          responseHandler.reject(
            "removeTargetServer",
            new Error(payload.error || "Failed to remove target server"),
          );
        },
      );

      socket.on(
        UI_ClientBoundMessage.UpdateTargetServerFailed,
        (payload: { error?: string }) => {
          responseHandler.reject(
            "updateTargetServer",
            new Error(payload.error || "Failed to update target server"),
          );
        },
      );
    }

    function removeEventListeners() {
      if (!socket || !listenersBound) return;
      listenersBound = false;

      socket.off("disconnect");
      socket.off("connect_failed");

      socket.off(UI_ClientBoundMessage.AppConfig);
      socket.off(UI_ClientBoundMessage.SystemState);
      socket.off(UI_ClientBoundMessage.TargetServerAdded);
      socket.off(UI_ClientBoundMessage.TargetServerRemoved);
      socket.off(UI_ClientBoundMessage.TargetServerUpdated);
      socket.off(UI_ClientBoundMessage.AddTargetServerFailed);
      socket.off(UI_ClientBoundMessage.RemoveTargetServerFailed);
      socket.off(UI_ClientBoundMessage.UpdateTargetServerFailed);
    }

    function connect(token: string = "") {
      if (socket?.connected) return;

      const url = getMcpxServerURL("ws");
      set({ isPending: true, connectError: false });
      pendingAppConfig = true;
      pendingSystemState = true;

      socket = io(url, {
        auth: { token },
        path: "/ws-ui",
        transports: ["websocket"],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        timeout: 20000,
      });

      set({ socket });

      socket.on("connect", () => {
        set({ isConnected: true, connectError: false, isPending: false });
        emitGetAppConfig();
        emitGetSystemState();
      });

      socket.on("connect_error", (error) => {
        console.error("WebSocket connection error:", error);
        set({ connectError: true, isConnected: false, isPending: false });
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
      socket.connect();
    }

    function disconnect() {
      if (socket) {
        removeEventListeners();
        socket.disconnect();
        socket = null;
      }
      responseHandler.cleanup();
      set({ isConnected: false, connectError: false, isPending: false });
    }

    function safeEmit(message: UI_ServerBoundMessage, data?: unknown) {
      if (!socket?.connected) {
        throw new Error("WebSocket not connected");
      }
      socket.emit(message, data);
    }

    function createOperation<T>(
      operationId: string,
      message: UI_ServerBoundMessage,
      data?: unknown,
      timeoutMs?: number,
    ): Promise<T> {
      const promise = responseHandler.createPromise<T>(operationId, timeoutMs);
      safeEmit(message, data);
      return promise;
    }

    function emitGetAppConfig() {
      safeEmit(UI_ServerBoundMessage.GetAppConfig);
    }

    function emitGetSystemState() {
      safeEmit(UI_ServerBoundMessage.GetSystemState);
    }

    function emitPatchAppConfig(
      config: ApplyParsedAppConfigRequest,
    ): Promise<SerializedAppConfig> {
      return createOperation<SerializedAppConfig>(
        "patchAppConfig",
        UI_ServerBoundMessage.PatchAppConfig,
        config,
      );
    }

    function emitAddTargetServer(
      server: RawCreateTargetServerRequest,
    ): Promise<SerializedAppConfig> {
      return createOperation<SerializedAppConfig>(
        "addTargetServer",
        UI_ServerBoundMessage.AddTargetServer,
        server,
        30000, // 30 second timeout for server operations
      );
    }

    function emitRemoveTargetServer(
      name: string,
    ): Promise<SerializedAppConfig> {
      return createOperation<SerializedAppConfig>(
        "removeTargetServer",
        UI_ServerBoundMessage.RemoveTargetServer,
        { name },
      );
    }

    function emitUpdateTargetServer(
      name: string,
      data: RawUpdateTargetServerRequest,
    ): Promise<SerializedAppConfig> {
      return createOperation<SerializedAppConfig>(
        "updateTargetServer",
        UI_ServerBoundMessage.UpdateTargetServer,
        { name, data },
      );
    }

    return {
      appConfig: null,
      connect,
      disconnect,
      connectError: false,
      emitAddTargetServer,
      emitPatchAppConfig,
      emitRemoveTargetServer,
      emitUpdateTargetServer,
      isConnected: false,
      isPending: true,
      serializedAppConfig: null,
      socket: null, // This will be updated when connect() is called
      systemState: null,
    };
  }),
);

export const useSocketStore = <T>(selector: (state: SocketStore) => T) =>
  socketStore(useShallow(selector));

// Expose store to window for E2E testing
if (typeof window !== "undefined") {
  window.__MCPX_SOCKET_STORE__ = socketStore;
}
