import { afterEach, describe, expect, it, vi } from "vitest";
import { type SystemState, UI_ClientBoundMessage } from "@mcpx/shared-model";

const socketHarness = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    connected: false,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
      return socket;
    }),
    emit: vi.fn(),
    connect: vi.fn(() => {
      socket.connected = true;
      handlers.get("connect")?.();
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
    }),
  };
  return { handlers, socket };
});

vi.mock("socket.io-client", () => ({ io: vi.fn(() => socketHarness.socket) }));

import { socketStore } from "./socket";

describe("socket activity", () => {
  afterEach(() => {
    socketStore.getState().disconnect();
    socketHarness.handlers.clear();
    vi.clearAllMocks();
  });

  it("tracks active calls immediately and clears them on disconnect", async () => {
    await socketStore.getState().connect();
    socketHarness.handlers.get(UI_ClientBoundMessage.SystemState)?.({
      targetServers: [],
      connectedClients: [],
      connectedClientClusters: [],
      usage: { callCount: 0 },
      activeCallCount: 2,
      lastUpdatedAt: new Date(),
    } as SystemState);

    expect(socketStore.getState().activeCallCount).toBe(2);

    socketStore.getState().disconnect();

    expect(socketStore.getState().activeCallCount).toBe(0);
  });

  it("updates active calls from the lightweight activity event", async () => {
    await socketStore.getState().connect();

    socketHarness.handlers.get("activeCallCountChanged")?.({
      activeCallCount: 3,
    });

    expect(socketStore.getState().activeCallCount).toBe(3);
  });

  it("stays pending until app config and system state are received", async () => {
    await socketStore.getState().connect();

    expect(socketStore.getState().isPending).toBe(true);

    const appConfig = {
      yaml: "{}",
      version: 1,
      lastModified: new Date(),
    };
    socketHarness.handlers.get(UI_ClientBoundMessage.AppConfig)?.(appConfig);

    expect(socketStore.getState().serializedAppConfig).toEqual(appConfig);
    expect(socketStore.getState().isPending).toBe(true);

    socketHarness.handlers.get(UI_ClientBoundMessage.SystemState)?.({
      targetServers: [],
      connectedClients: [],
      connectedClientClusters: [],
      usage: { callCount: 0 },
      activeCallCount: 2,
      lastUpdatedAt: new Date(),
    } as SystemState);

    expect(socketStore.getState().activeCallCount).toBe(2);
    expect(socketStore.getState().isPending).toBe(false);
  });

  it("starts a fresh bootstrap after reconnecting", async () => {
    await socketStore.getState().connect();
    socketHarness.handlers.get(UI_ClientBoundMessage.AppConfig)?.({
      yaml: "{}",
      version: 1,
      lastModified: new Date(),
    });
    socketHarness.handlers.get(UI_ClientBoundMessage.SystemState)?.({
      targetServers: [],
      connectedClients: [],
      connectedClientClusters: [],
      usage: { callCount: 0 },
      lastUpdatedAt: new Date(),
    } as SystemState);
    expect(socketStore.getState().isPending).toBe(false);

    socketHarness.handlers.get("reconnect")?.();

    expect(socketStore.getState().isPending).toBe(true);
  });
});
