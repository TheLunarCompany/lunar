import { echoTargetServer, getTestHarness, TestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";
const INITIAL_TIMESTAMP = 1000;

describe("Behavior flags gate server operations", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = getTestHarness({
      targetServers: [],
      behaviorPayload: {
        mcpxBehaviorSettings: {
          featureFlags: { enableResourceCapability: false },
          policies: {
            stdioServersEnabled: false,
            dockerInDockerEnabled: false,
          },
        },
        timestamp: INITIAL_TIMESTAMP,
      },
    });
    await harness.initialize("StreamableHTTP");
    harness.emitIdentity({ entityType: "user", role: "member" });
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  it("stdioServersEnabled policy", async () => {
    const serverPayload = { ...echoTargetServer, name: "behavior-test-server" };

    const rejected = await fetch(`${MCPX_BASE_URL}/target-server`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serverPayload),
    });
    expect(rejected.status).toBe(403);

    const socketId = harness.mockHubServer.getConnectedClients()[0]!;
    await harness.mockHubServer.emitBehaviorWithAck(socketId, {
      mcpxBehaviorSettings: {
        featureFlags: { enableResourceCapability: false },
        policies: { stdioServersEnabled: true, dockerInDockerEnabled: false },
      },
      timestamp: INITIAL_TIMESTAMP + 1,
    });

    const allowed = await fetch(`${MCPX_BASE_URL}/target-server`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serverPayload),
    });
    expect(allowed.status).toBe(201);
  });
});
