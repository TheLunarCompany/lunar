import { echoTargetServer, getTestHarness, TestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

describe("Setup Change on Target Server Changes", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = getTestHarness();
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

    const response = await fetch(`${MCPX_BASE_URL}/target-server`, {
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
      `${MCPX_BASE_URL}/target-server/calculator-service`,
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
});
