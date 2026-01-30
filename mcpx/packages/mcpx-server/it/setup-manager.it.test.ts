import {
  catalogItemsToPayload,
  echoTargetServer,
  calculatorTargetServer,
  getTestHarness,
  stdioCatalogItems,
  TestHarness,
} from "./utils.js";
import {
  McpxBoundPayloads,
  targetServerSchema,
} from "@mcpx/webapp-protocol/messages";
import z from "zod/v4";
import { TargetServer } from "../src/model/target-servers.js";

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

function getConnectedServerNames(harness: TestHarness): string[] {
  return harness.services.targetClients.servers.map((s) => s.name);
}

describe("SetupManager Integration Tests", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    const catalogPayload = catalogItemsToPayload(stdioCatalogItems);
    harness = getTestHarness({ targetServers: [] }); // Start with no servers
    await harness.initialize("StreamableHTTP");

    const socketId = harness.mockHubServer.getConnectedClients()[0]!;
    await harness.mockHubServer.emitCatalogWithAck(socketId, catalogPayload);
  });

  afterEach(async () => {
    await harness.shutdown();
  });

  it("applies setup and connects servers", async () => {
    const setupPayload = createSetupPayload([
      echoTargetServer,
      calculatorTargetServer,
    ]);

    await harness.services.setupManager.applySetup(setupPayload);

    const connectedNames = getConnectedServerNames(harness);
    expect(connectedNames).toContain(echoTargetServer.name);
    expect(connectedNames).toContain(calculatorTargetServer.name);
    expect(connectedNames).toHaveLength(2);
  });

  it("replaces servers on subsequent setup", async () => {
    // First setup with both servers
    await harness.services.setupManager.applySetup(
      createSetupPayload([echoTargetServer, calculatorTargetServer]),
    );
    expect(getConnectedServerNames(harness)).toHaveLength(2);

    // Second setup with only echo
    await harness.services.setupManager.applySetup(
      createSetupPayload([echoTargetServer]),
    );

    const connectedNames = getConnectedServerNames(harness);
    expect(connectedNames).toContain(echoTargetServer.name);
    expect(connectedNames).not.toContain(calculatorTargetServer.name);
    expect(connectedNames).toHaveLength(1);
  });
});
