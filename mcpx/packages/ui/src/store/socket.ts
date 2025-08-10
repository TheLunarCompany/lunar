import {
  AppConfig,
  appConfigSchema,
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
import { getWebServerURL } from "../config/api-config";
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

  // Socket Actions
  connect: () => void;
};

export const socketStore = create<SocketStore>((set, get) => {
  let socket: Socket;
  let pendingAppConfig = true;
  let pendingSystemState = true;

  const debouncedSystemStateUpdate = debounce((newState: SystemState) => {
    const currentState = get().systemState;

    if (isSystemStateChanged(currentState, newState)) {
      set({ systemState: newState });
    }
  }, 2000);

  function listen() {
    socket.on("connect", () => {
      set({ connectError: false, isConnected: true });
      emitGetAppConfig();
      emitGetSystemState();
    });

    socket.on("disconnect", () => {
      set({ isConnected: false });
    });

    socket.on("connect_failed", () => {
      console.error("Connection failed");
      set({ connectError: true, isConnected: false });
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error", error.message);
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
          console.error("Failed to parse app config", error);
          set({ appConfig: null });
        }

        if (get().isPending && !pendingSystemState) {
          set({ isPending: false });
        }
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
  }

  function connect(token: string = "") {
    const url = getWebServerURL("ws");
    socket = io(url, { auth: { token }, path: "/ws-ui" });
    socket.connect();
    listen();
  }

  function emitGetAppConfig() {
    socket.emit(UI_ServerBoundMessage.GetAppConfig);
  }

  function emitGetSystemState() {
    socket.emit(UI_ServerBoundMessage.GetSystemState);
  }

  return {
    appConfig: null,
    connect,
    connectError: false,
    isConnected: false,
    isPending: true,
    serializedAppConfig: null,
    systemState: null,
  };
});

export const useSocketStore = <T>(selector: (state: SocketStore) => T) =>
  socketStore(useShallow(selector));
