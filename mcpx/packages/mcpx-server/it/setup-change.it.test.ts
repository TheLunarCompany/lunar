import { withAsyncPolling } from "@aigw/core/time";
import { WebappBoundPayloads } from "@mcpx/webapp-protocol/messages";
import { AddressInfo, createServer } from "node:net";
import { echoTargetServer, getTestHarness, TestHarness } from "./utils.js";

async function reserveFreePort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, resolve));
  const { port } = reservation.address() as AddressInfo;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  return port;
}

describe("Setup Change on Target Server Changes", () => {
  let harness: TestHarness;
  let baseUrl: string;

  beforeAll(async () => {
    const port = await reserveFreePort();
    baseUrl = `http://localhost:${port}`;
    harness = getTestHarness({ mcpxPort: port });
    await harness.initialize("StreamableHTTP");
    // Use space identity (non-strict) to allow adding servers not in catalog
    harness.emitIdentity({ entityType: "space" });
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  beforeEach(() => {
    harness.mockHubServer.clearSetupChangeMessages();
  });

  it("should send setup-change to Hub when a target server is added", async () => {
    const setupChangePromise = harness.mockHubServer.waitForSetupChange();

    const response = await fetch(`${baseUrl}/target-server`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...echoTargetServer, name: "new-test-server" }),
    });
    expect(response.status).toBe(201);

    const setupChangeMessage = await setupChangePromise;

    expect(setupChangeMessage).toBeDefined();
    const envelope = setupChangeMessage as { payload: unknown };
    expect(envelope.payload).toBeDefined();

    const payload = envelope.payload as Record<string, unknown>;
    expect(payload["source"]).toBe("user");

    const targetServers = payload["targetServers"] as Record<string, unknown>;
    expect(targetServers["new-test-server"]).toBeDefined();
  });

  it("should send setup-change to Hub when a target server is removed", async () => {
    const setupChangePromise = harness.mockHubServer.waitForSetupChange();

    const response = await fetch(
      `${baseUrl}/target-server/calculator-service`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(200);

    const setupChangeMessage = await setupChangePromise;

    expect(setupChangeMessage).toBeDefined();
    const envelope = setupChangeMessage as { payload: unknown };
    expect(envelope.payload).toBeDefined();

    const payload = envelope.payload as Record<string, unknown>;
    expect(payload["source"]).toBe("user");

    const targetServers = payload["targetServers"] as Record<string, unknown>;
    expect(targetServers["calculator-service"]).toBeUndefined();
  });

  // AIGW-480: a server added over REST lists its keys in another order than its
  // copy the Hub sends back, which used to re-add it and delete its OAuth tokens.
  it("keeps a server added over REST when the Hub sends its setup back", async () => {
    const name = "round-trip-server";
    const added = harness.mockHubServer.waitForSetupChange();
    const response = await fetch(`${baseUrl}/target-server`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...echoTargetServer, name }),
    });
    expect(response.status).toBe(201);
    const { payload } = (await added) as { payload: unknown };
    const { clientsByService } = harness.services.upstreamHandler;
    const before = clientsByService.get(name);
    expect(before).toBeDefined();

    // The Hub parses the setup-change, stores it and sends it back as apply-setup.
    const { targetServers, config } =
      WebappBoundPayloads.setupChange.parse(payload);
    const [socketId] = harness.mockHubServer.getConnectedClients();
    if (!socketId) throw new Error("MCPX is not connected to the mock Hub");
    const correlationId = "round-trip";
    harness.mockHubServer.emitToClient(socketId, "apply-setup", {
      metadata: { id: "round-trip", correlationId },
      payload: { setupId: "round-trip", targetServers, config },
    });
    // MCPX answers once the setup is applied, with the same correlationId.
    await withAsyncPolling({
      maxAttempts: 50,
      sleepTimeMs: 100,
      getValue: async () =>
        harness.mockHubServer
          .getSetupChangeMessages()
          .some(
            (message) =>
              (message as { metadata?: { correlationId?: string } }).metadata
                ?.correlationId === correlationId,
          ),
      found: (answered): answered is true => answered,
    });

    // Same instance: the server was never removed and re-added.
    expect(clientsByService.get(name)).toBe(before);
  });
});
