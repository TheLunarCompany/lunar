import { v7 as uuidv7 } from "uuid";
import { CatalogManagerI } from "../src/services/catalog-manager.js";
import {
  AuthStatus,
  ConfigServiceForHub,
  HubService,
} from "../src/services/hub.js";
import { CurrentSetup, SetupManagerI } from "../src/services/setup-manager.js";
import { IdentityServiceI } from "../src/services/identity-service.js";
import {
  UpstreamHandlerOAuthHandler,
  TargetServerChangeNotifier,
} from "../src/services/upstream-handler.js";
import type { TargetServer } from "../src/model/target-servers.js";
import { EnvVarManager } from "../src/services/env-var-manager.js";
import { MockHubServer } from "./mock-hub-server.js";
import { getMcpxLogger } from "./utils.js";

// Minimal test doubles for dependencies not relevant to Hub connection tests
class StubSetupManager implements SetupManagerI {
  async applySetup() {
    return {
      source: "hub" as const,
      targetServers: {},
      config: {
        toolGroups: [],
        toolExtensions: { services: {} },
        staticOauth: undefined,
        permissions: { default: { block: [] }, consumers: {} },
        auth: { enabled: false },
      },
    };
  }
  isDigesting() {
    return false;
  }
  getCurrentSetup(): CurrentSetup {
    return {
      targetServers: {},
      config: {
        toolGroups: [],
        toolExtensions: { services: {} },
        staticOauth: undefined,
        permissions: { default: { block: [] }, consumers: {} },
        auth: { enabled: false },
        targetServerAttributes: {},
      },
    };
  }
  buildUserConfigChangePayload() {
    return null;
  }
  buildUserTargetServersChangePayload() {
    return null;
  }
}

class StubCatalogManager implements CatalogManagerI {
  setCatalog() {}
  getCatalog() {
    return [];
  }
  getById() {
    return undefined;
  }
  isStrict() {
    return true;
  }
  setAdminStrictnessOverride() {}
  getAdminStrictnessOverride() {
    return false;
  }
  isServerApproved() {
    return true;
  }
  isToolApproved() {
    return true;
  }
  isPromptApproved() {
    return true;
  }
  subscribe() {
    return () => {};
  }
}

class StubIdentityService implements IdentityServiceI {
  getIdentity() {
    return {
      mode: "enterprise" as const,
      entity: { entityType: "user" as const, role: "member" as const },
    };
  }
  setIdentity() {}
  subscribe() {
    return () => {};
  }
  isSpace() {
    return false;
  }
  isAdmin() {
    return false;
  }
  hasAdminPrivileges() {
    return false;
  }
  isStrictPermissionsEnabled() {
    return true;
  }
  getDisplayName() {
    return undefined;
  }
}

class StubConfigService implements ConfigServiceForHub {
  registerPostCommitHook() {}
}

class StubTargetClients
  implements TargetServerChangeNotifier, UpstreamHandlerOAuthHandler
{
  registerPostChangeHook(
    _hookName: string,
    _hook: (servers: TargetServer[]) => void,
  ) {}
  async initiateOAuthForServer() {
    return { authorizationUrl: "", state: "", userCode: undefined };
  }
  async completeOAuthByState() {}
}

// Resolves once the service reaches `target` status (or rejects on timeout).
function waitForStatus(
  hub: HubService,
  target: AuthStatus["status"],
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (hub.status.status === target) return resolve();
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error(`Timed out waiting for status: ${target}`));
    }, timeoutMs);
    hub.addStatusListener((status) => {
      if (settled || status.status !== target) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });
  });
}

// Resolves once the service's status carries a connectionError of `name`.
function waitForConnectionError(
  hub: HubService,
  name: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (hub.status.connectionError?.name === name) return resolve();
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error(`Timed out waiting for connectionError: ${name}`));
    }, timeoutMs);
    hub.addStatusListener((status) => {
      if (settled || status.connectionError?.name !== name) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });
  });
}

describe("HubService", () => {
  const HUB_PORT = 9002;
  const HUB_URL = `http://localhost:${HUB_PORT}`;
  const VALID_USER_ID = "valid-user-id-123";
  const INVALID_USER_ID = "invalid-user-id";

  let mockHubServer: MockHubServer;
  let hubService: HubService | null;
  const logger = getMcpxLogger();
  const stubSetupManager = new StubSetupManager();
  const stubCatalogManager = new StubCatalogManager();
  const stubConfigService = new StubConfigService();
  const stubIdentityService = new StubIdentityService();
  const stubTargetClients = new StubTargetClients();
  const stubEnvVarManager = new EnvVarManager(logger);
  const stubGetUsageStats = () => ({ agents: [], targetServers: [] });

  const makeHub = (options: { connectionTimeout?: number } = {}): HubService =>
    new HubService(
      logger,
      stubSetupManager,
      stubCatalogManager,
      stubEnvVarManager,
      stubConfigService,
      stubIdentityService,
      stubTargetClients,
      stubGetUsageStats,
      { hubUrl: HUB_URL, ...options },
    );

  // Start a fresh Hub on the same port that accepts VALID_USER_ID.
  const bringHubUp = async (): Promise<void> => {
    mockHubServer = new MockHubServer({ port: HUB_PORT, logger });
    await mockHubServer.waitForListening();
    mockHubServer.setValidTokens([VALID_USER_ID]);
  };

  beforeEach(async () => {
    // Start mock hub server
    mockHubServer = new MockHubServer({ port: HUB_PORT, logger });

    // Wait for server to start listening
    await mockHubServer.waitForListening();
  });

  afterEach(async () => {
    // Cleanup
    if (hubService) {
      await hubService.disconnect();
      hubService = null;
    }

    await mockHubServer.close();
  });

  describe("Connection with user ID", () => {
    it("should connect successfully with valid user ID", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      await hubService!.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService!, "authenticated", 5000);

      expect(hubService!.status.status).toBe("authenticated");
      expect(hubService!.status.connectionError).toBeUndefined();

      // Verify server sees the connection
      expect(mockHubServer.getConnectedClients()).toHaveLength(1);
    });

    it("should fail to connect with invalid user ID", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      await hubService.connect({ setupOwnerId: INVALID_USER_ID });
      await waitForConnectionError(hubService, "HubUnavailableError", 5000);

      expect(hubService.status.status).toBe("unauthenticated");

      // Verify no clients connected
      expect(mockHubServer.getConnectedClients()).toHaveLength(0);
    });

    it("should fail when server is not available", async () => {
      // Close the server to simulate unavailability
      await mockHubServer.close();

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 1000, // Short timeout for faster test
        },
      );

      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      // A refused connection surfaces as unavailable.
      await waitForConnectionError(hubService, "HubUnavailableError", 5000);
      expect(hubService.status.status).toBe("unauthenticated");
    });
  });

  describe("Disconnect behavior", () => {
    it("should update status to unauthenticated on disconnect", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      // Connect first
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);

      // Disconnect
      await hubService.disconnect();

      // Verify status is unauthenticated
      expect(hubService.status.status).toBe("unauthenticated");
    });
  });

  describe("Reconnection behavior", () => {
    it("should return existing status when already connected", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      // First connection
      await hubService!.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService!, "authenticated", 5000);

      const firstClients = mockHubServer.getConnectedClients();
      expect(firstClients).toHaveLength(1);
      const firstClientId = firstClients[0];

      // Second connect() call is idempotent and doesn't reconnect.
      const secondResult = await hubService!.connect({
        setupOwnerId: VALID_USER_ID,
      });
      expect(secondResult.status).toBe("authenticated");

      // Should still have the same client (no reconnection)
      const secondClients = mockHubServer.getConnectedClients();
      expect(secondClients).toHaveLength(1);
      expect(secondClients[0]).toBe(firstClientId);
    });
  });

  describe("Catalog acknowledgment", () => {
    it("should acknowledge set-catalog message with ok: true", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);

      const clients = mockHubServer.getConnectedClients();
      expect(clients).toHaveLength(1);
      const socketId = clients[0]!;

      // Emit catalog with ack and verify it's acknowledged
      const ackResult = await mockHubServer.emitCatalogWithAck(socketId, {
        items: [
          {
            server: {
              id: uuidv7(),
              name: "test-server",
              displayName: "Test Server",
              config: { type: "stdio", command: "npx", args: ["-y", "test"] },
            },
          },
        ],
      });

      expect(ackResult).toEqual({ ok: true });
    });

    it("should acknowledge set-catalog with ok: false on parse failure", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);
      const clients = mockHubServer.getConnectedClients();
      const socketId = clients[0]!;

      // Emit invalid catalog (missing required fields)
      const ackResult = await mockHubServer.emitCatalogWithAck(socketId, {
        items: "not-an-array", // Invalid - should be array
      } as unknown as { items: [] });

      expect(ackResult).toEqual({ ok: false });
    });
  });

  describe("Status management", () => {
    it("should notify multiple listeners on status change", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      const listener1Statuses: AuthStatus[] = [];
      const listener2Statuses: AuthStatus[] = [];

      hubService.addStatusListener((status) => {
        listener1Statuses.push(status);
      });

      hubService.addStatusListener((status) => {
        listener2Statuses.push(status);
      });

      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);

      // Both listeners notified with the authenticated status.
      expect(listener1Statuses).toHaveLength(1);
      expect(listener1Statuses[0]?.status).toBe("authenticated");

      expect(listener2Statuses).toHaveLength(1);
      expect(listener2Statuses[0]?.status).toBe("authenticated");
    });

    it("should not notify when status doesn't change", async () => {
      mockHubServer.setValidTokens([]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 1000,
        },
      );

      let notificationCount = 0;
      hubService.addStatusListener(() => {
        notificationCount++;
      });

      // First failed connection
      await hubService.connect({ setupOwnerId: INVALID_USER_ID });
      await waitForConnectionError(hubService, "HubUnavailableError", 5000);
      expect(notificationCount).toBe(1);

      // Second connect() is idempotent; same status, no extra notification.
      await hubService.connect({ setupOwnerId: INVALID_USER_ID });
      await new Promise((r) => setTimeout(r, 100));
      expect(notificationCount).toBe(1);
    });
  });

  describe("Recovery after Hub outage", () => {
    it("recovers on its own once the Hub returns, without a manual reconnect", async () => {
      // Hub is down while the instance boots.
      await mockHubServer.close();
      hubService = makeHub();

      // Wait until the first attempt has actually failed, so recovery must go
      // through a background retry rather than a lucky immediate connect.
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForConnectionError(hubService, "HubUnavailableError", 5000);

      await bringHubUp();

      // The instance authenticates without a second connect() call.
      await waitForStatus(hubService, "authenticated", 10000);
      expect(hubService.status.status).toBe("authenticated");
      expect(mockHubServer.getConnectedClients()).toHaveLength(1);
    }, 15000);

    // Hub is up but rejects the handshake (e.g. its PostgreSQL is down, so
    // getSetupOwner throws -> next(err)). Same code path the real Hub takes.
    it("recovers once the Hub accepts the handshake again, without a manual reconnect", async () => {
      // Hub is reachable but rejects this owner's handshake.
      mockHubServer.setValidTokens([]);
      hubService = makeHub();

      // Wait for the rejection so recovery must go through the re-arm path.
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForConnectionError(hubService, "HubUnavailableError", 5000);

      // The Hub's dependency recovers -> the handshake now succeeds.
      mockHubServer.setValidTokens([VALID_USER_ID]);

      // The instance authenticates on its own, no second connect() call.
      await waitForStatus(hubService, "authenticated", 10000);
      expect(hubService.status.status).toBe("authenticated");
    }, 15000);

    // A second connect() (e.g. the UI POSTing on page load) must not disturb a
    // healthy connection. connect() is idempotent and only observes status.
    it("stays authenticated when connect() is called again", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        { hubUrl: HUB_URL, connectionTimeout: 5000 },
      );

      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);
      const clientId = mockHubServer.getConnectedClients()[0];

      // Repeated connect() calls return the live status and don't reconnect.
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await hubService.connect({ setupOwnerId: VALID_USER_ID });

      await new Promise((r) => setTimeout(r, 300));
      expect(hubService.status.status).toBe("authenticated");
      const clients = mockHubServer.getConnectedClients();
      expect(clients).toHaveLength(1);
      expect(clients[0]).toBe(clientId);
    }, 15000);

    // Connected, then the Hub goes away mid-session and returns. Exercises the
    // disconnect handler + socket.io's own reconnect (transport error).
    it("recovers from a mid-session transport drop", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);
      hubService = makeHub({ connectionTimeout: 5000 });

      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);

      await mockHubServer.close();
      await waitForStatus(hubService, "unauthenticated", 5000);

      await bringHubUp();

      await waitForStatus(hubService, "authenticated", 10000);
      expect(hubService.status.status).toBe("authenticated");
      expect(mockHubServer.getConnectedClients()).toHaveLength(1);
    }, 20000);

    // Hub force-disconnects the client. socket.io treats this as terminal
    // (socket.active === false), so the re-arm timer must bring it back.
    it("recovers when the Hub force-disconnects the client", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);
      hubService = makeHub({ connectionTimeout: 5000 });

      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);
      const firstId = mockHubServer.getConnectedClients()[0]!;

      mockHubServer.disconnectClient(firstId);
      await waitForStatus(hubService, "unauthenticated", 5000);

      // Server is still up and the token valid, so re-arm reconnects.
      await waitForStatus(hubService, "authenticated", 10000);
      expect(hubService.status.status).toBe("authenticated");
      expect(mockHubServer.getConnectedClients()).toHaveLength(1);
    }, 20000);

    // A second connect() during an outage (the UI POSTs on page load) is a
    // safe no-op and the instance still recovers to a single connection.
    it("recovers when connect() is called again during an outage", async () => {
      await mockHubServer.close();
      hubService = makeHub();

      // Both calls happen while the Hub is down; wait for the failure so the
      // second connect() is genuinely a mid-outage no-op, not a lucky connect.
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForConnectionError(hubService, "HubUnavailableError", 5000);

      await bringHubUp();

      await waitForStatus(hubService, "authenticated", 10000);
      expect(hubService.status.status).toBe("authenticated");
      expect(mockHubServer.getConnectedClients()).toHaveLength(1);
    }, 20000);

    // A second connect() landing during a handshake re-arm backoff (the UI POST
    // path) must not cancel the pending re-arm and stall recovery.
    it("recovers when connect() is called during a handshake re-arm backoff", async () => {
      // Hub rejects the handshake -> a re-arm is scheduled.
      mockHubServer.setValidTokens([]);
      hubService = makeHub();
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForConnectionError(hubService, "HubUnavailableError", 5000);

      // Second connect() during the backoff (idempotent no-op).
      await hubService.connect({ setupOwnerId: VALID_USER_ID });

      // Hub starts accepting; the re-arm must still fire and recover.
      mockHubServer.setValidTokens([VALID_USER_ID]);
      await waitForStatus(hubService, "authenticated", 10000);
      expect(hubService.status.status).toBe("authenticated");
    }, 15000);
  });

  describe("Tool call batching", () => {
    const BATCH_INTERVAL_MS = 50;

    function makeHubService(): HubService {
      return new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubEnvVarManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
          toolCallBatchIntervalMs: BATCH_INTERVAL_MS,
        },
      );
    }

    beforeEach(() => {
      mockHubServer.setValidTokens([VALID_USER_ID]);
    });

    it("delivers recorded tool calls to hub on interval flush", async () => {
      hubService = makeHubService();
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);

      hubService.recordToolCall({
        serverName: "my-server",
        toolName: "my-tool",
        clientName: "claude-ai",
        consumerTag: "claude",
        durationMs: 123,
        isError: false,
        isCallFailure: false,
      });

      const envelope = await mockHubServer.waitForToolCallBatch(2000);
      const { payload } = envelope as { payload: { events: unknown[] } };

      expect(payload.events).toHaveLength(1);
      expect(payload.events[0]).toMatchObject({
        serverName: "my-server",
        toolName: "my-tool",
        clientName: "claude-ai",
        consumerTag: "claude",
        durationMs: 123,
        errorType: null,
      });
    });

    it("maps isError:true to errorType tool_error", async () => {
      hubService = makeHubService();
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);

      hubService.recordToolCall({
        serverName: "s",
        toolName: "t",
        clientName: undefined,
        consumerTag: "c",
        durationMs: 10,
        isError: true,
        isCallFailure: false,
      });

      const envelope = await mockHubServer.waitForToolCallBatch(2000);
      const { payload } = envelope as {
        payload: { events: { errorType: unknown }[] };
      };

      expect(payload.events[0]?.errorType).toBe("tool_error");
    });

    it("maps isCallFailure:true to errorType call_failed", async () => {
      hubService = makeHubService();
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);

      hubService.recordToolCall({
        serverName: "s",
        toolName: "t",
        clientName: undefined,
        consumerTag: "c",
        durationMs: 10,
        isError: true,
        isCallFailure: true,
      });

      const envelope = await mockHubServer.waitForToolCallBatch(2000);
      const { payload } = envelope as {
        payload: { events: { errorType: unknown }[] };
      };

      expect(payload.events[0]?.errorType).toBe("call_failed");
    });

    // The batcher is stopped on disconnect and restarted on reconnect; a call
    // recorded after a mid-session outage must still flush.
    it("resumes flushing tool calls after a reconnect", async () => {
      hubService = makeHubService();
      await hubService.connect({ setupOwnerId: VALID_USER_ID });
      await waitForStatus(hubService, "authenticated", 5000);

      // Hub drops and returns.
      await mockHubServer.close();
      await waitForStatus(hubService, "unauthenticated", 5000);
      await bringHubUp();
      await waitForStatus(hubService, "authenticated", 10000);

      hubService.recordToolCall({
        serverName: "s",
        toolName: "t",
        clientName: undefined,
        consumerTag: "c",
        durationMs: 10,
        isError: false,
        isCallFailure: false,
      });

      const envelope = await mockHubServer.waitForToolCallBatch(2000);
      expect(envelope).toBeDefined();
    }, 20000);

    // Shutdown-flush is intentionally not tested here.
    //
    // disconnect() calls batcher.shutdown() which flushes via socket.emit() before
    // calling socket.disconnect(). TCP guarantees the batch packet is transmitted before
    // the disconnect packet, so the hub receives it in production.
    //
    // In-process tests are unreliable for this: socket.io event dispatch goes through
    // microtasks/callbacks, and the server-side handler may not fire before the test
    // assertion runs — even though the data was sent. The BatchBuffer unit test covers
    // the shutdown-flush logic at the pure level.
  });
});
