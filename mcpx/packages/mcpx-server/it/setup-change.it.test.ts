import { echoTargetServer, getTestHarness, TestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";

// Base config that satisfies API requirements
const baseConfig = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
  },
  toolGroups: [],
  auth: { enabled: false },
  toolExtensions: { services: {} },
  targetServerAttributes: {},
};

interface ConfigTestCase {
  name: string;
  configChange: Record<string, unknown>;
  verify: (payload: Record<string, unknown>) => void;
}

// Test cases for each config part that triggers setup-change to Hub
const configTestCases: ConfigTestCase[] = [
  {
    name: "permissions",
    configChange: {
      permissions: {
        default: { _type: "default-allow", block: ["blocked-group"] },
        consumers: { guest: { _type: "default-block", allow: [] } },
      },
      toolGroups: [
        { name: "blocked-group", services: { "calculator-service": ["add"] } },
      ],
    },
    verify: (payload) => {
      const config = payload["config"] as Record<string, unknown>;
      const permissions = config["permissions"] as Record<string, unknown>;
      const defaultPerm = permissions["default"] as { block: string[] };
      expect(defaultPerm.block).toContain("blocked-group");
    },
  },
  {
    name: "toolGroups",
    configChange: {
      toolGroups: [
        { name: "my-group", services: { "echo-service": ["echo"] } },
      ],
    },
    verify: (payload) => {
      const config = payload["config"] as Record<string, unknown>;
      const toolGroups = config["toolGroups"] as Array<{ name: string }>;
      expect(toolGroups).toContainEqual(
        expect.objectContaining({ name: "my-group" }),
      );
    },
  },
  {
    name: "auth",
    configChange: {
      auth: { enabled: true },
    },
    verify: (payload) => {
      const config = payload["config"] as Record<string, unknown>;
      const auth = config["auth"] as { enabled: boolean };
      expect(auth.enabled).toBe(true);
    },
  },
  {
    name: "toolExtensions",
    configChange: {
      toolExtensions: {
        services: {
          "echo-service": {
            echo: {
              childTools: [
                {
                  name: "echo_loud",
                  description: { action: "append", text: " (loud version)" },
                  overrideParams: {},
                },
              ],
            },
          },
        },
      },
    },
    verify: (payload) => {
      const config = payload["config"] as Record<string, unknown>;
      const toolExtensions = config["toolExtensions"] as {
        services: Record<string, unknown>;
      };
      expect(toolExtensions.services["echo-service"]).toBeDefined();
    },
  },
  {
    name: "targetServerAttributes",
    configChange: {
      targetServerAttributes: {
        "calculator-service": { inactive: true },
      },
    },
    verify: (payload) => {
      const config = payload["config"] as Record<string, unknown>;
      const attrs = config["targetServerAttributes"] as Record<string, unknown>;
      expect(attrs["calculator-service"]).toEqual({ inactive: true });
    },
  },
];

describe("Setup Change Messages on Config Changes", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = getTestHarness();
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  beforeEach(() => {
    harness.mockHubServer.clearSetupChangeMessages();
  });

  it.each(configTestCases)(
    "should send setup-change to Hub when $name is updated",
    async ({ configChange, verify }) => {
      const configUpdate = { ...baseConfig, ...configChange };

      // Start waiting for setup-change before triggering the request
      const setupChangePromise = harness.mockHubServer.waitForSetupChange();

      const response = await fetch(`${MCPX_BASE_URL}/app-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configUpdate),
      });
      expect(response.status).toBe(200);

      const setupChangeMessage = await setupChangePromise;

      expect(setupChangeMessage).toBeDefined();
      const envelope = setupChangeMessage as { payload: unknown };
      expect(envelope.payload).toBeDefined();

      const payload = envelope.payload as Record<string, unknown>;
      expect(payload["source"]).toBe("user");
      verify(payload);
    },
  );
});

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
