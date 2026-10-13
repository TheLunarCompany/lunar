import {
  allCatalogItems,
  allTargetServers,
  buildConfig,
  getTestHarness,
  TestHarness,
  transportTypes,
} from "./utils.js";

const OAUTH_MOCK_SERVER_URL = "http://localhost:9001";

// Helper to control the OAuth mock server
async function authorizeUser(user: string): Promise<void> {
  const response = await fetch(`${OAUTH_MOCK_SERVER_URL}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to authorize user ${user}: ${await response.text()}`,
    );
  }
}

async function revokeAuthorization(): Promise<void> {
  const response = await fetch(`${OAUTH_MOCK_SERVER_URL}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to revoke authorization: ${await response.text()}`);
  }
}

async function getServerStatus(): Promise<{
  authorizedUser: string | null;
  availableUsers: string[];
}> {
  const response = await fetch(`${OAUTH_MOCK_SERVER_URL}/status`);
  if (!response.ok) {
    throw new Error(`Failed to get server status: ${await response.text()}`);
  }
  return response.json();
}

// These tests are still not perfect as the OAuth mock MCP server is not really playing
// by-the-book as far as OAuth flows go.
describe.each(transportTypes)("OAuth flow over %s", (transportType) => {
  let testHarness: TestHarness;

  beforeEach(async () => {
    // Ensure no user is authorized at start
    await revokeAuthorization();

    testHarness = getTestHarness({
      config: buildConfig(),
      targetServers: allTargetServers,
      catalogItems: allCatalogItems,
    });
    await testHarness.initialize(transportType);

    // Note: OAuth target server is added during test execution to trigger OAuth flow
  });

  afterEach(async () => {
    await testHarness.shutdown();
    await revokeAuthorization(); // Clean up
  });

  describe.skip("when user is not authorized", () => {
    it("should not be able to call tools on OAuth-protected server", async () => {
      // Verify server has no authorized user
      const status = await getServerStatus();
      expect(status.authorizedUser).toBeNull();

      // Try to call tool - should fail because server will reject with 401
      // and OAuth flow won't complete (no authorization)
      await expect(
        testHarness.client.callTool({
          name: "oauth-mock-server__get-user-data",
          arguments: {},
        }),
      ).rejects.toThrow();
    });
  });

  describe("when user alice is authorized", () => {
    it("should successfully connect and return alice's data", async () => {
      // Start the tool call (this will trigger OAuth flow)
      await authorizeUser("user_alice");
      const toolCallPromise = testHarness.client.callTool({
        name: "oauth-mock-server__get-user-data",
        arguments: {},
      });

      // Wait for the tool call to complete
      const result = await toolCallPromise;

      const content = result.content as { type: string; text: string }[];
      expect(content).toHaveLength(1);
      expect(content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("user_alice"),
      });
      expect(content[0]?.text).toContain("Alice's secret project");
      expect(content[0]?.text).toContain("Alice's private notes");
      expect(content[0]?.text).toContain("Alice's API keys");
    });
  });

  describe("when user bob is authorized", () => {
    it("should successfully connect and return bob's data", async () => {
      await authorizeUser("user_bob");
      const result = await testHarness.client.callTool({
        name: "oauth-mock-server__get-user-data",
        arguments: {},
      });

      const content = result.content as { type: string; text: string }[];
      expect(content).toHaveLength(1);
      expect(content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("user_bob"),
      });
      expect(content[0]?.text).toContain("Bob's confidential files");
      expect(content[0]?.text).toContain("Bob's personal data");
      expect(content[0]?.text).toContain("Bob's passwords");
    });
  });

  describe("when switching between users", () => {
    it("should return different data for different users", async () => {
      // Start with Alice
      await authorizeUser("user_alice");
      const aliceResult = await testHarness.client.callTool({
        name: "oauth-mock-server__get-user-data",
        arguments: {},
      });

      const aliceContent = aliceResult.content as {
        type: string;
        text: string;
      }[];
      expect(aliceContent[0]?.text).toContain("Alice's secret project");

      // Switch to Bob
      await authorizeUser("user_bob");
      const bobResult = await testHarness.client.callTool({
        name: "oauth-mock-server__get-user-data",
        arguments: {},
      });

      const bobContent = bobResult.content as { type: string; text: string }[];
      expect(bobContent[0]?.text).toContain("Bob's confidential files");
      expect(bobContent[0]?.text).not.toContain("Alice's secret project");
    });
  });

  describe.skip("when unknown user tries to authorize", () => {
    it("should fail to authorize and remain unable to call tools", async () => {
      // Try to authorize unknown user
      await expect(authorizeUser("user_unknown")).rejects.toThrow();

      // Verify no user is authorized
      const status = await getServerStatus();
      expect(status.authorizedUser).toBeNull();

      // Tool calls should still fail
      await expect(
        testHarness.client.callTool({
          name: "oauth-mock-server__get-user-data",
          arguments: {},
        }),
      ).rejects.toThrow();
    });
  });

  describe("server status verification", () => {
    it("should show available users and current authorization state", async () => {
      // Initially no user authorized
      let status = await getServerStatus();
      expect(status.authorizedUser).toBeNull();
      expect(status.availableUsers).toEqual(["user_alice", "user_bob"]);

      // After authorizing Alice
      await authorizeUser("user_alice");
      status = await getServerStatus();
      expect(status.authorizedUser).toBe("user_alice");

      // After revoking
      await revokeAuthorization();
      status = await getServerStatus();
      expect(status.authorizedUser).toBeNull();
    });
  });
});
