import {
  NextVersionAppConfig as AppConfig,
  nextVersionAppConfigSchema as appConfigSchema,
  ConnectedClient,
  SerializedAppConfig,
  TargetServer,
  TargetServerNew,
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
  type SystemState,
} from "@mcpx/shared-model";
import { io, type Socket } from "socket.io-client";
import YAML from "yaml";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { getMcpxServerURL } from "../config/api-config";
import { areSetsEqual, debounce } from "../utils";

// Pure function to detect significant changes in system state
function isSystemStateChanged(
  oldState: SystemState | null,
  newState: SystemState,
): boolean {
  if (!oldState) return true;

  // Compare servers using stable identifiers
  const oldServerSet = createServerSet(oldState.targetServers);
  const newServerSet = createServerSet(newState.targetServers);
  const oldServerSet_new = createServerSet(oldState.targetServers_new);
  const newServerSet_new = createServerSet(newState.targetServers_new);

  // Compare clients
  const oldClientSet = createClientSet(oldState.connectedClients);
  const newClientSet = createClientSet(newState.connectedClients);

  const hasChanges =
    !areSetsEqual(oldServerSet, newServerSet) ||
    !areSetsEqual(oldClientSet, newClientSet) ||
    !areSetsEqual(oldServerSet_new, newServerSet_new);

  return hasChanges;
}

function createServerSet(
  servers: (TargetServer | TargetServerNew)[] | undefined,
): Set<string> {
  if (!servers || servers.length === 0) return new Set();

  return new Set(
    servers.map((server) => {
      const toolCount = server.tools?.length || 0;
      const toolUsage = (server.tools || [])
        .map((tool) => `${tool.name}:${tool.usage?.callCount || 0}`)
        .sort()
        .join(",");

      return `${server.name}|${toolCount}|${toolUsage}`;
    }),
  );
}

// Create Set for clients
function createClientSet(clients: ConnectedClient[] | undefined): Set<string> {
  if (!clients || clients.length === 0) return new Set();

  return new Set(
    clients.map((client) => {
      // Use sessionId as stable identifier
      return client.sessionId || "unknown";
    }),
  );
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
  emitPatchAppConfig: (config: any) => Promise<SerializedAppConfig>;
  emitAddTargetServer: (server: any) => Promise<any>;
  emitRemoveTargetServer: (name: string) => Promise<any>;
  emitUpdateTargetServer: (name: string, data: any) => Promise<any>;
};

export const socketStore = create<SocketStore>((set, get) => {
  let socket: Socket;
  let pendingAppConfig = true;
  let pendingSystemState = true;

  // Response handlers for promise-based operations
  const responseHandlers = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  // Helper function to create a response handler
  function createResponseHandler(
    operationId: string,
    timeoutMs: number = 10000,
  ) {
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        responseHandlers.delete(operationId);
        reject(new Error(`Operation ${operationId} timed out`));
      }, timeoutMs);

      responseHandlers.set(operationId, { resolve, reject, timeout });
    });
  }

  // Helper function to resolve a response
  function resolveResponse(operationId: string, value: any) {
    const handler = responseHandlers.get(operationId);
    if (handler) {
      clearTimeout(handler.timeout);
      responseHandlers.delete(operationId);
      handler.resolve(value);
    }
  }

  // Helper function to reject a response
  function rejectResponse(operationId: string, error: any) {
    const handler = responseHandlers.get(operationId);
    if (handler) {
      clearTimeout(handler.timeout);
      responseHandlers.delete(operationId);
      handler.reject(error);
    }
  }

  const debouncedSystemStateUpdate = debounce((newState: SystemState) => {
    const currentState = get().systemState;

    if (isSystemStateChanged(currentState, newState)) {
      set({ systemState: newState });
    }
  }, 500); // Reduced debounce time for more responsive updates

  function listen() {
    socket.on("disconnect", () => {
      set({ isConnected: false });
    });

    socket.on("connect_failed", () => {
      console.error("Connection failed");
      set({ connectError: true, isConnected: false });
    });

    socket.on(
      UI_ClientBoundMessage.AppConfig,
      (payload: SerializedAppConfig) => {
        pendingAppConfig = false;

        try {
          const parsedAppConfig = appConfigSchema.parse(
            YAML.parse(payload.yaml),
          );
          set({
            appConfig: parsedAppConfig,
            serializedAppConfig: payload,
          });
        } catch (error) {
          console.warn(
            "Failed to parse app config, continuing without it:",
            error,
          );
          // Set app config to null but keep the serialized version for potential retry
          set({
            appConfig: null,
            serializedAppConfig: payload,
          });
        }

        if (get().isPending && !pendingSystemState) {
          set({ isPending: false });
        }

        // Resolve any pending app config responses
        resolveResponse("patchAppConfig", payload);
      },
    );

    socket.on(UI_ClientBoundMessage.SystemState, (payload: SystemState) => {
      pendingSystemState = false;

      const currentState = get().systemState;

      if (!currentState) {
        set({ systemState: payload });
        if (get().isPending && !pendingAppConfig) {
          set({ isPending: false });
        }
      } else {
        debouncedSystemStateUpdate(payload);
      }
    });

    // Listen for server addition events
    socket.on(UI_ClientBoundMessage.TargetServerAdded, (payload: any) => {
      // Resolve any pending add server responses
      resolveResponse("addTargetServer", payload);
      // Trigger a system state refresh to update the UI
      emitGetSystemState();
    });

    socket.on(UI_ClientBoundMessage.AddTargetServerFailed, (payload: any) => {
      console.error("Failed to add target server:", payload);
      // Reject any pending add server responses
      rejectResponse(
        "addTargetServer",
        new Error(payload.error || "Failed to add target server"),
      );
    });

    // Listen for server removal events
    socket.on(UI_ClientBoundMessage.TargetServerRemoved, (payload: any) => {
      console.log("Target server removed:", payload);
      // Resolve any pending remove server responses
      resolveResponse("removeTargetServer", payload);
      // Trigger a system state refresh to update the UI
      emitGetSystemState();
    });

    socket.on(
      UI_ClientBoundMessage.RemoveTargetServerFailed,
      (payload: any) => {
        console.error("Failed to remove target server:", payload);
        // Reject any pending remove server responses
        rejectResponse(
          "removeTargetServer",
          new Error(payload.error || "Failed to remove target server"),
        );
      },
    );

    // Listen for server update events
    socket.on(UI_ClientBoundMessage.TargetServerUpdated, (payload: any) => {
      console.log("Target server updated:", payload);
      // Resolve any pending update server responses
      resolveResponse("updateTargetServer", payload);
      // Trigger a system state refresh to update the UI
      emitGetSystemState();
    });

    socket.on(
      UI_ClientBoundMessage.UpdateTargetServerFailed,
      (payload: any) => {
        console.error("Failed to update target server:", payload);
        // Reject any pending update server responses
        rejectResponse(
          "updateTargetServer",
          new Error(payload.error || "Failed to update target server"),
        );
      },
    );
  }

  function connect(token: string = "") {
    const url = getMcpxServerURL("ws");

    // Disconnect existing socket if any
    if (socket) {
      socket.disconnect();
    }

    socket = io(url, {
      auth: { token },
      path: "/ws-ui",
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });
    set({ socket });

    socket.on("connect", () => {
      set({ isConnected: true, connectError: false });
      // Request initial data when connected
      emitGetAppConfig();
      emitGetSystemState();
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      set({ connectError: true, isConnected: false });
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("WebSocket reconnected after", attemptNumber, "attempts");
      set({ isConnected: true, connectError: false });
      // Request fresh data after reconnection
      emitGetAppConfig();
      emitGetSystemState();
    });

    socket.on("reconnect_error", (error) => {
      console.error("WebSocket reconnection error:", error);
      set({ connectError: true, isConnected: false });
    });

    socket.on("reconnect_failed", () => {
      console.error("WebSocket reconnection failed after all attempts");
      set({ connectError: true, isConnected: false });
    });

    socket.connect();
    listen();
  }

  function emitGetAppConfig() {
    socket.emit(UI_ServerBoundMessage.GetAppConfig);
  }

  function emitGetSystemState() {
    socket.emit(UI_ServerBoundMessage.GetSystemState);
  }

  function emitPatchAppConfig(config: any): Promise<SerializedAppConfig> {
    if (!socket || !socket.connected) {
      return Promise.reject(new Error("WebSocket not connected"));
    }

    const promise = createResponseHandler("patchAppConfig");
    socket.emit(UI_ServerBoundMessage.PatchAppConfig, config);
    return promise;
  }

  function emitAddTargetServer(server: any): Promise<any> {
    if (!socket || !socket.connected) {
      return Promise.reject(new Error("WebSocket not connected"));
    }

    const promise = createResponseHandler("addTargetServer");
    socket.emit(UI_ServerBoundMessage.AddTargetServer, server);
    return promise;
  }

  function emitRemoveTargetServer(name: string): Promise<any> {
    if (!socket || !socket.connected) {
      return Promise.reject(new Error("WebSocket not connected"));
    }

    const promise = createResponseHandler("removeTargetServer");
    socket.emit(UI_ServerBoundMessage.RemoveTargetServer, { name });
    return promise;
  }

  function emitUpdateTargetServer(name: string, data: any): Promise<any> {
    if (!socket || !socket.connected) {
      return Promise.reject(new Error("WebSocket not connected"));
    }

    const promise = createResponseHandler("updateTargetServer");
    socket.emit(UI_ServerBoundMessage.UpdateTargetServer, { name, data });
    return promise;
  }

  return {
    appConfig: null,
    connect,
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
});

export const useSocketStore = <T>(selector: (state: SocketStore) => T) =>
  socketStore(useShallow(selector));
