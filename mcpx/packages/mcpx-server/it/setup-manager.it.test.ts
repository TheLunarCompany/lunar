import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  catalogItemsToPayload,
  echoTargetServer,
  calculatorTargetServer,
  getTestHarness,
  stdioCatalogItems,
  TestHarness,
} from "./utils.js";
import { McpxBoundPayloads } from "@mcpx/webapp-protocol/messages";
import z from "zod/v4";
import { TargetServer } from "../src/model/target-servers.js";

type ApplySetupPayload = z.infer<typeof McpxBoundPayloads.applySetup>;

function toTargetServerEntry(
  server: TargetServer,
): ApplySetupPayload["targetServers"][string] {
  const { catalogItemId, ...initiation } = server;
  return {
    initiation,
    catalogItemId,
  };
}

function createSetupPayload(
  servers: TargetServer[],
  setupId: string = "test-setup-001",
): ApplySetupPayload {
  const targetServers: ApplySetupPayload["targetServers"] = {};
  servers.forEach((server) => {
    targetServers[server.name] = toTargetServerEntry(server);
  });

  return {
    source: "profile",
    setupId,
    targetServers,
    config: {
      toolGroups: [],
      toolExtensions: { services: {} },
      staticOauth: undefined,
      permissions: {
        default: { _type: "default-allow", block: [] },
        consumers: {},
        clientNames: {},
      },
      auth: { enabled: false },
      targetServerAttributes: {},
    },
  };
}

function getConnectedServerNames(harness: TestHarness): string[] {
  return harness.services.upstreamHandler.servers.map((s) => s.name);
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

  it("does not tear down unchanged servers on re-apply", async () => {
    // Re-applying a setup (e.g. on sub-catalog reassignment) must not remove
    // and re-add unchanged servers, which would drop their OAuth tokens.
    await harness.services.setupManager.applySetup(
      createSetupPayload([echoTargetServer, calculatorTargetServer]),
    );
    const echoBefore = harness.services.upstreamHandler.clientsByService.get(
      echoTargetServer.name,
    );

    // Re-apply the same setup with a different setupId (as a reassignment would).
    await harness.services.setupManager.applySetup(
      createSetupPayload(
        [echoTargetServer, calculatorTargetServer],
        "test-setup-002",
      ),
    );

    const echoAfter = harness.services.upstreamHandler.clientsByService.get(
      echoTargetServer.name,
    );
    // toBe, not toEqual: same instance means it was never removed + recreated.
    expect(echoAfter).toBe(echoBefore);
    expect(getConnectedServerNames(harness)).toHaveLength(2);
  });

  it("only touches the changed server when one is added", async () => {
    await harness.services.setupManager.applySetup(
      createSetupPayload([echoTargetServer]),
    );
    const echoBefore = harness.services.upstreamHandler.clientsByService.get(
      echoTargetServer.name,
    );

    await harness.services.setupManager.applySetup(
      createSetupPayload([echoTargetServer, calculatorTargetServer]),
    );

    const echoAfter = harness.services.upstreamHandler.clientsByService.get(
      echoTargetServer.name,
    );
    expect(echoAfter).toBe(echoBefore); // unchanged server left as-is
    const connectedNames = getConnectedServerNames(harness);
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
