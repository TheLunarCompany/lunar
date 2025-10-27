import { promises as fsPromises } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  AuthStatus,
  ConfigServiceForHub,
  HubService,
  TargetClientsForHub,
} from "../src/services/hub.js";
import { SetupManagerI } from "../src/services/setup-manager.js";
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
      },
    };
  }
  isDigesting() {
    return false;
  }
  buildUserConfigChangePayload() {
    return null;
  }
  buildUserTargetServersChangePayload() {
    return null;
  }
}

class StubConfigService implements ConfigServiceForHub {
  registerPostCommitHook() {}
}

class StubTargetClients implements TargetClientsForHub {
  registerPostChangeHook() {}
}

describe("HubService", () => {
  const HUB_PORT = 9002;
  const HUB_URL = `http://localhost:${HUB_PORT}`;
  const VALID_TOKEN = "valid-test-token-123";
  const INVALID_TOKEN = "invalid-test-token";

  let mockHubServer: MockHubServer;
  let hubService: HubService | null;
  let tempDir: string;
  const logger = getMcpxLogger();
  const stubSetupManager = new StubSetupManager();
  const stubConfigService = new StubConfigService();
  const stubTargetClients = new StubTargetClients();
  const stubGetUsageStats = () => ({ agents: [], targetServers: [] });

  beforeEach(async () => {
    // Create temp directory for token persistence
    tempDir = await fsPromises.mkdtemp(join(tmpdir(), "hub-test-"));

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

    // Clean up temp directory
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  });

  describe("Connection with supplied token", () => {
    it("should connect successfully with valid token", async () => {
      mockHubServer.setValidTokens([VALID_TOKEN]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
          connectionTimeout: 5000,
        },
      );

      const statusPromise = new Promise<AuthStatus>((resolve) => {
        hubService!.addStatusListener((status) => {
          resolve(status);
        });
      });

      const connectResult = await hubService!.connect(VALID_TOKEN);

      expect(connectResult.status).toBe("authenticated");
      expect(connectResult.connectionError).toBeUndefined();

      // Verify listener was called
      const listenerStatus = await statusPromise;
      expect(listenerStatus.status).toBe("authenticated");

      // Verify token was persisted
      const tokenPath = join(tempDir, "mcpx-hub", "hub-token.json");
      const tokenData = await fsPromises.readFile(tokenPath, "utf8");
      const parsed = JSON.parse(tokenData);
      expect(parsed.token).toBe(VALID_TOKEN);

      // Verify server sees the connection
      expect(mockHubServer.getConnectedClients()).toHaveLength(1);
    });

    it("should fail to connect with invalid token", async () => {
      mockHubServer.setValidTokens([VALID_TOKEN]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
          connectionTimeout: 5000,
        },
      );

      const connectResult = await hubService.connect(INVALID_TOKEN);

      expect(connectResult.status).toBe("unauthenticated");
      expect(connectResult.connectionError?.name).toBe("HubUnavailableError");

      // Verify no clients connected
      expect(mockHubServer.getConnectedClients()).toHaveLength(0);

      // Verify token was NOT persisted
      const tokenPath = join(tempDir, "mcpx-hub", "hub-token.json");
      await expect(fsPromises.access(tokenPath)).rejects.toThrow();
    });

    it("should fail when server is not available", async () => {
      // Close the server to simulate unavailability
      await mockHubServer.close();

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
          connectionTimeout: 1000, // Short timeout for faster test
        },
      );

      const connectResult = await hubService.connect(VALID_TOKEN);

      expect(connectResult.status).toBe("unauthenticated");
      expect(connectResult.connectionError?.name).toBe("HubUnavailableError");
    });
  });

  describe("Token persistence", () => {
    it("should read persisted token when no token supplied", async () => {
      // First, persist a token
      const tokenDir = join(tempDir, "mcpx-hub");
      await fsPromises.mkdir(tokenDir, { recursive: true });
      await fsPromises.writeFile(
        join(tokenDir, "hub-token.json"),
        JSON.stringify({ token: VALID_TOKEN }),
      );

      mockHubServer.setValidTokens([VALID_TOKEN]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
          connectionTimeout: 5000,
        },
      );

      // Connect without supplying token
      const connectResult = await hubService.connect();

      expect(connectResult.status).toBe("authenticated");
      expect(connectResult.connectionError).toBeUndefined();
    });

    it("should return unauthenticated when no token available", async () => {
      hubService = new HubService(
        logger,
        stubSetupManager,
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
          connectionTimeout: 5000,
        },
      );

      // Connect without supplying token and no persisted token
      const connectResult = await hubService.connect();

      expect(connectResult.status).toBe("unauthenticated");
      expect(connectResult.connectionError).toBeUndefined();
    });

    it("should delete persisted token on disconnect", async () => {
      mockHubServer.setValidTokens([VALID_TOKEN]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
          connectionTimeout: 5000,
        },
      );

      // Connect and verify token is persisted
      await hubService.connect(VALID_TOKEN);
      const tokenPath = join(tempDir, "mcpx-hub", "hub-token.json");
      await expect(fsPromises.access(tokenPath)).resolves.not.toThrow();

      // Disconnect
      await hubService.disconnect();

      // Verify token is deleted
      await expect(fsPromises.access(tokenPath)).rejects.toThrow();

      // Verify status is unauthenticated
      expect(hubService.status.status).toBe("unauthenticated");
    });
  });

  describe("Reconnection behavior", () => {
    it("should disconnect existing socket before new connection", async () => {
      mockHubServer.setValidTokens([VALID_TOKEN]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
          connectionTimeout: 5000,
        },
      );

      // First connection
      await hubService!.connect(VALID_TOKEN);
      const firstClients = mockHubServer.getConnectedClients();
      expect(firstClients).toHaveLength(1);
      const firstClientId = firstClients[0];

      // Setup promise to wait for the specific first client to disconnect
      const disconnectPromise = mockHubServer.waitForSpecificClientDisconnect(
        firstClientId!,
      );

      // Second connection (should disconnect first)
      await hubService!.connect(VALID_TOKEN);

      // Wait for the first client to disconnect
      await disconnectPromise;

      const secondClients = mockHubServer.getConnectedClients();
      expect(secondClients).toHaveLength(1);
      const secondClientId = secondClients[0];

      // Should be a different client
      expect(secondClientId).not.toBe(firstClientId);
    });
  });

  describe("Status management", () => {
    it("should notify multiple listeners on status change", async () => {
      mockHubServer.setValidTokens([VALID_TOKEN]);

      hubService = new HubService(
        logger,
        stubSetupManager,
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
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

      await hubService.connect(VALID_TOKEN);

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
        stubConfigService,
        stubTargetClients,
        stubGetUsageStats,
        {
          hubUrl: HUB_URL,
          authTokensDir: tempDir,
          connectionTimeout: 1000,
        },
      );

      let notificationCount = 0;
      hubService.addStatusListener(() => {
        notificationCount++;
      });

      // First failed connection
      await hubService.connect(INVALID_TOKEN);
      expect(notificationCount).toBe(1);

      // Second failed connection with same error type
      await hubService.connect(INVALID_TOKEN);

      // Should not notify again since status is the same
      expect(notificationCount).toBe(1);
    });
  });
});
