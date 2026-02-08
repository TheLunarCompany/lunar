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
  TargetClientsOAuthHandler,
  TargetServerChangeNotifier,
} from "../src/services/target-clients.js";
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
}

class StubConfigService implements ConfigServiceForHub {
  registerPostCommitHook() {}
}

class StubTargetClients
  implements TargetServerChangeNotifier, TargetClientsOAuthHandler
{
  registerPostChangeHook() {}
  async initiateOAuthForServer() {
    return { authorizationUrl: "", state: "", userCode: undefined };
  }
  async completeOAuthByState() {}
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
  const stubGetUsageStats = () => ({ agents: [], targetServers: [] });

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
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      const statusPromise = new Promise<AuthStatus>((resolve) => {
        hubService!.addStatusListener((status) => {
          resolve(status);
        });
      });

      const connectResult = await hubService!.connect({
        setupOwnerId: VALID_USER_ID,
      });

      expect(connectResult.status).toBe("authenticated");
      expect(connectResult.connectionError).toBeUndefined();

      // Verify listener was called
      const listenerStatus = await statusPromise;
      expect(listenerStatus.status).toBe("authenticated");

      // Verify server sees the connection
      expect(mockHubServer.getConnectedClients()).toHaveLength(1);
    });

    it("should fail to connect with invalid user ID", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 5000,
        },
      );

      const connectResult = await hubService.connect({
        setupOwnerId: INVALID_USER_ID,
      });

      expect(connectResult.status).toBe("unauthenticated");
      expect(connectResult.connectionError?.name).toBe("HubUnavailableError");

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
        stubConfigService,
        stubIdentityService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          connectionTimeout: 1000, // Short timeout for faster test
        },
      );

      const connectResult = await hubService.connect({
        setupOwnerId: VALID_USER_ID,
      });

      expect(connectResult.status).toBe("unauthenticated");
      expect(connectResult.connectionError?.name).toBe(
        "HubConnectionTimeoutError",
      );
    });
  });

  describe("Disconnect behavior", () => {
    it("should update status to unauthenticated on disconnect", async () => {
      mockHubServer.setValidTokens([VALID_USER_ID]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubCatalogManager,
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
      expect(hubService.status.status).toBe("authenticated");

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
      const firstResult = await hubService!.connect({
        setupOwnerId: VALID_USER_ID,
      });
      expect(firstResult.status).toBe("authenticated");

      const firstClients = mockHubServer.getConnectedClients();
      expect(firstClients).toHaveLength(1);
      const firstClientId = firstClients[0];

      // Second connect() call should return existing status without reconnecting
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
      expect(hubService.status.status).toBe("authenticated");

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

      // Both listeners should have been notified synchronously
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
      expect(notificationCount).toBe(1);

      // Second failed connection with same error type
      await hubService.connect({ setupOwnerId: INVALID_USER_ID });

      // Should not notify again since status is the same
      expect(notificationCount).toBe(1);
    });
  });
});
