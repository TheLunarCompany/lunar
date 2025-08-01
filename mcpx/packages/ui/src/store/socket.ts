import {
  AppConfig,
  appConfigSchema,
  ConnectedClient,
  SerializedAppConfig,
  TargetServer,
  UI_ClientBoundMessage,
  UI_ServerBoundMessage,
  type SystemState,
} from "@mcpx/shared-model";
import { io, type Socket } from "socket.io-client";
import YAML from "yaml";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
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

  // Compare clients
  const oldClientSet = createClientSet(oldState.connectedClients);
  const newClientSet = createClientSet(newState.connectedClients);

  const hasChanges =
    !areSetsEqual(oldServerSet, newServerSet) ||
    !areSetsEqual(oldClientSet, newClientSet);

  if (hasChanges) {
    console.log("Significant changes detected:", {
      serversChanged: !areSetsEqual(oldServerSet, newServerSet),
      clientsChanged: !areSetsEqual(oldClientSet, newClientSet),
    });
  }

  return hasChanges;
}

// Create Set for servers using stable identifiers
function createServerSet(servers: TargetServer[] | undefined): Set<string> {
  if (!servers || servers.length === 0) return new Set();

  return new Set(
    servers.map((server) => {
      // Use command as stable identifier (more reliable than user-chosen name)
      const stableId = `${server.command}::${server.args}` || server.name;
      const toolCount = server.tools?.length || 0;

      // Include tool usage information for change detection
      const toolUsage = (server.tools || [])
        .map((tool) => `${tool.name}:${tool.usage?.callCount || 0}`)
        .sort()
        .join(",");

      return `${stableId}|${toolCount}|${toolUsage}`;
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
  appConfig: AppConfig | null;
  serializedAppConfig: SerializedAppConfig | null;
  isConnected: boolean;
  systemState: SystemState | null;
  connect: () => void;
};

export const socketStore = create<SocketStore>((set, get) => {
  let socket: Socket | undefined = undefined;

  // Debounced system state update function
  const debouncedSystemStateUpdate = debounce((newState: SystemState) => {
    const currentState = get().systemState;

    // Only update if there are additions/deletions
    if (isSystemStateChanged(currentState, newState)) {
      set({ systemState: newState });
    }
  }, 2000); // 2 second debounce as requested

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
      const currentState = get().systemState;

      // Use immediate update for initial load, debounced for subsequent updates
      if (!currentState) {
        set({ systemState: payload });
      } else {
        debouncedSystemStateUpdate(payload);
      }
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
