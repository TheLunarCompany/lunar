import {
  calculatorTargetServer,
  catalogItemsToPayload,
  echoCatalogItem,
  echoTargetServer,
  getTestHarness,
  stdioCatalogItems,
  TestHarness,
} from "./utils.js";
import { TargetServer } from "../src/model/target-servers.js";
import {
  McpxBoundPayloads,
  targetServerSchema,
} from "@mcpx/webapp-protocol/messages";
import z from "zod/v4";

// Helper to create a custom valid server
function createCustomServer(name: string): TargetServer {
  return {
    ...echoTargetServer,
    name,
  };
}

// Helper to create setup payload
type ApplySetupPayload = z.infer<typeof McpxBoundPayloads.applySetup>;
type TargetServerConfig = z.infer<typeof targetServerSchema>;

function createSetupPayload(
  servers: TargetServer[],
  setupId: string = "test-setup-001",
): ApplySetupPayload {
  const targetServers: Record<string, TargetServerConfig> = {};
  servers.forEach((server) => {
    const { name, ...config } = server;
    targetServers[name] = config;
  });

  return {
    source: "profile",
    setupId,
    targetServers,
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

// Helper to get connected server names from harness
function getConnectedServerNames(harness: TestHarness): string[] {
  return harness.services.targetClients.servers.map((s) => s.name);
}

describe("SetupManager Integration Tests", () => {
  const catalogServers = [echoTargetServer, calculatorTargetServer];

  describe("Member User (isStrict: true) - Catalog only servers", () => {
    let harness: TestHarness;

    beforeEach(async () => {
      const catalogPayload = catalogItemsToPayload(stdioCatalogItems, true);
      harness = getTestHarness({ targetServers: catalogServers });
      await harness.initialize("StreamableHTTP");

      const socketId = harness.mockHubServer.getConnectedClients()[0]!;
      await harness.mockHubServer.emitCatalogWithAck(socketId, catalogPayload);
    });

    afterEach(async () => {
      await harness.shutdown();
    });

    it("should apply only catalog servers when non-catalog server is included", async () => {
      const customServer = createCustomServer("non-catalog-server");
      const setupPayload = createSetupPayload([
        ...catalogServers,
        customServer,
      ]);

      await harness.services.setupManager.applySetup(setupPayload);

      const connectedNames = getConnectedServerNames(harness);
      expect(connectedNames).toContain(echoTargetServer.name);
      expect(connectedNames).toContain(calculatorTargetServer.name);
      expect(connectedNames).not.toContain(customServer.name);
      expect(connectedNames).toHaveLength(2);
    });

    it("should apply no servers when all servers are non-catalog", async () => {
      const nonCatalogServers = [
        createCustomServer("non-catalog-1"),
        createCustomServer("non-catalog-2"),
      ];
      const setupPayload = createSetupPayload(nonCatalogServers);

      await harness.services.setupManager.applySetup(setupPayload);

      const connectedNames = getConnectedServerNames(harness);
      expect(connectedNames).toHaveLength(0);
    });

    it("should NOT rollback when some servers fail (partial success)", async () => {
      const failServer = createCustomServer("non-catalog-will-fail");
      const setupPayload = createSetupPayload([
        echoTargetServer,
        calculatorTargetServer,
        failServer,
      ]);

      await harness.services.setupManager.applySetup(setupPayload);

      const connectedNames = getConnectedServerNames(harness);
      expect(connectedNames).toContain(echoTargetServer.name);
      expect(connectedNames).toContain(calculatorTargetServer.name);
      expect(connectedNames).not.toContain(failServer.name);
      expect(connectedNames).toHaveLength(2);
    });
  });

  describe("Admin User (isStrict: false) - Any server allowed", () => {
    let harness: TestHarness;

    beforeEach(async () => {
      const catalogPayload = catalogItemsToPayload([echoCatalogItem], false);
      harness = getTestHarness({ targetServers: [echoTargetServer] });
      await harness.initialize("StreamableHTTP");

      const socketId = harness.mockHubServer.getConnectedClients()[0]!;
      await harness.mockHubServer.emitCatalogWithAck(socketId, catalogPayload);
    });

    afterEach(async () => {
      await harness.shutdown();
    });

    it("should apply all servers including non-catalog ones", async () => {
      const setupPayload = createSetupPayload([
        echoTargetServer,
        calculatorTargetServer,
        createCustomServer("custom-server"),
      ]);

      await harness.services.setupManager.applySetup(setupPayload);

      const connectedNames = getConnectedServerNames(harness);
      expect(connectedNames).toContain(echoTargetServer.name);
      expect(connectedNames).toContain(calculatorTargetServer.name);
      expect(connectedNames).toContain("custom-server");
      expect(connectedNames).toHaveLength(3);
    });
  });
});
