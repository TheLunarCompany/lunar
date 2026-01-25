import { wrapInEnvelope } from "@mcpx/webapp-protocol/messages";
import { resetEnv } from "../src/env.js";
import { TESTKIT_SERVER_ENV_READER } from "../src/testkit/root.js";
import { getTestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";
const RECOVERY_ENV_VAR_NAME = "IT_TEST_RECOVERY_VAR";
const RECOVERY_ENV_VALUE = "recovered-value";

// Used to add a target server via API, like UI does (REST and WS both use the same underlying engine)
async function addServer(
  name: string,
  env: Record<string, string | { fromEnv: string } | null>,
): Promise<Response> {
  return fetch(`${MCPX_BASE_URL}/target-server`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      type: "stdio",
      command: "node",
      args: [TESTKIT_SERVER_ENV_READER],
      env,
    }),
  });
}

// Emit strict catalog to enable pending-input validation
// TODO(MCP-701): Remove when admin-awareness is properly implemented
function emitStrictCatalog(
  harness: ReturnType<typeof getTestHarness>,
  serverNames: string[],
): void {
  const payload = {
    items: serverNames.map((name) => ({
      server: {
        name,
        displayName: name,
        config: {
          type: "stdio",
          command: "node",
          args: [TESTKIT_SERVER_ENV_READER],
        },
      },
    })),
    isStrict: true,
  };
  const envelope = wrapInEnvelope({ payload });
  const socketId = harness.mockHubServer.getConnectedClients()[0];
  harness.mockHubServer.emitToClient(socketId!, "set-catalog", envelope);
}

describe("Target Server States - pending-input", () => {
  const testHarness = getTestHarness({ targetServers: [] });

  beforeAll(async () => {
    process.env["STDIO_INHERIT_PROCESS_ENV"] = "false";
    resetEnv();

    await testHarness.initialize("StreamableHTTP");

    // Enable strict mode to test pending-input validation
    // Include all server names that will be used in tests
    emitStrictCatalog(testHarness, [
      "recoverable-server",
      "empty-literal-server",
      "null-env-server",
      "multi-missing-server",
    ]);
  });

  afterAll(async () => {
    await testHarness.shutdown();
    process.env["STDIO_INHERIT_PROCESS_ENV"] = "false";
    resetEnv();
  });

  describe("recovery from pending-input state", () => {
    const serverName = "recoverable-server";

    beforeEach(async () => {
      const response = await addServer(serverName, {
        REQUIRED_VAR: { fromEnv: RECOVERY_ENV_VAR_NAME },
      });
      expect(response.status).toBe(201);
    });

    afterEach(async () => {
      await fetch(`${MCPX_BASE_URL}/target-server/${serverName}`, {
        method: "DELETE",
      });
    });

    it("server starts in pending-input state when fromEnv reference is missing", () => {
      const client =
        testHarness.services.targetClients.clientsByService.get(serverName);

      expect(client).toBeDefined();
      expect(client?._state).toBe("pending-input");
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([
        {
          key: "REQUIRED_VAR",
          type: "fromEnv",
          fromEnvName: RECOVERY_ENV_VAR_NAME,
        },
      ]);
    });

    it("server recovers to connected state when updated with valid env", async () => {
      // Verify starting in pending-input
      let client =
        testHarness.services.targetClients.clientsByService.get(serverName);
      expect(client?._state).toBe("pending-input");

      // Update server with literal value instead of fromEnv reference
      const response = await fetch(
        `${MCPX_BASE_URL}/target-server/${serverName}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "stdio",
            command: "node",
            args: [TESTKIT_SERVER_ENV_READER],
            env: { REQUIRED_VAR: RECOVERY_ENV_VALUE },
          }),
        },
      );
      expect(response.status).toBe(200);

      // Verify server is now connected
      client =
        testHarness.services.targetClients.clientsByService.get(serverName);
      expect(client?._state).toBe("connected");

      // Verify the server is functional - can call tools
      const result = await testHarness.client.callTool({
        name: `${serverName}__getEnv`,
        arguments: { name: "REQUIRED_VAR" },
      });
      expect(result.content).toEqual([
        { type: "text", text: RECOVERY_ENV_VALUE },
      ]);
    });
  });

  describe("empty literal string causes pending-input", () => {
    const serverName = "empty-literal-server";

    beforeAll(async () => {
      const response = await addServer(serverName, {
        EMPTY_VAR: "",
        VALID_VAR: "valid-value",
      });
      expect(response.status).toBe(201);
    });

    it("server enters pending-input when env var is empty string", () => {
      const client =
        testHarness.services.targetClients.clientsByService.get(serverName);

      expect(client).toBeDefined();
      expect(client?._state).toBe("pending-input");
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([{ key: "EMPTY_VAR", type: "literal" }]);
    });
  });

  describe("null values are dropped from initiation", () => {
    const serverName = "null-env-server";

    beforeAll(async () => {
      const response = await addServer(serverName, {
        INTENTIONALLY_EMPTY: null,
        VALID_VAR: "valid-value",
      });
      expect(response.status).toBe(201);
    });

    it("server connects successfully when env var is null (intentionally empty)", () => {
      const client =
        testHarness.services.targetClients.clientsByService.get(serverName);

      expect(client).toBeDefined();
      expect(client?._state).toBe("connected");
    });

    it("null env var is not passed to child process", async () => {
      const result = await testHarness.client.callTool({
        name: `${serverName}__getEnv`,
        arguments: { name: "INTENTIONALLY_EMPTY" },
      });

      expect(result.content).toEqual([
        { type: "text", text: "ENV_NOT_FOUND:INTENTIONALLY_EMPTY" },
      ]);
    });

    it("valid env var is still passed to child process", async () => {
      const result = await testHarness.client.callTool({
        name: `${serverName}__getEnv`,
        arguments: { name: "VALID_VAR" },
      });

      expect(result.content).toEqual([{ type: "text", text: "valid-value" }]);
    });
  });

  describe("partial fix of multiple missing env vars", () => {
    const serverName = "multi-missing-server";
    const MISSING_VAR_1 = "IT_TEST_MISSING_VAR_1";
    const MISSING_VAR_2 = "IT_TEST_MISSING_VAR_2";

    beforeEach(async () => {
      const response = await addServer(serverName, {
        VAR_1: { fromEnv: MISSING_VAR_1 },
        VAR_2: { fromEnv: MISSING_VAR_2 },
      });
      expect(response.status).toBe(201);
    });

    afterEach(async () => {
      await fetch(`${MCPX_BASE_URL}/target-server/${serverName}`, {
        method: "DELETE",
      });
    });

    it("reports all missing env vars initially", () => {
      const client =
        testHarness.services.targetClients.clientsByService.get(serverName);

      expect(client).toBeDefined();
      expect(client?._state).toBe("pending-input");
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([
        { key: "VAR_1", type: "fromEnv", fromEnvName: MISSING_VAR_1 },
        { key: "VAR_2", type: "fromEnv", fromEnvName: MISSING_VAR_2 },
      ]);
    });

    it("fixing one var still leaves server in pending-input with remaining missing var", async () => {
      // Fix VAR_1 but leave VAR_2 still missing
      const response = await fetch(
        `${MCPX_BASE_URL}/target-server/${serverName}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "stdio",
            command: "node",
            args: [TESTKIT_SERVER_ENV_READER],
            env: {
              VAR_1: "fixed-value",
              VAR_2: { fromEnv: MISSING_VAR_2 },
            },
          }),
        },
      );

      expect(response.status).toBe(200);

      const client =
        testHarness.services.targetClients.clientsByService.get(serverName);

      expect(client?._state).toBe("pending-input");
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([
        { key: "VAR_2", type: "fromEnv", fromEnvName: MISSING_VAR_2 },
      ]);
    });

    it("fixing all vars transitions to connected", async () => {
      const response = await fetch(
        `${MCPX_BASE_URL}/target-server/${serverName}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "stdio",
            command: "node",
            args: [TESTKIT_SERVER_ENV_READER],
            env: {
              VAR_1: "fixed-value-1",
              VAR_2: "fixed-value-2",
            },
          }),
        },
      );

      expect(response.status).toBe(200);

      const client =
        testHarness.services.targetClients.clientsByService.get(serverName);

      expect(client?._state).toBe("connected");
    });
  });

  // TODO(MCP-701): This test documents the temporary hack behavior - remove when admin-awareness is implemented
  describe("non-strict mode skips pending-input (sandbox mode)", () => {
    const serverName = "non-strict-server";

    beforeAll(async () => {
      // Switch to non-strict mode
      emitStrictCatalog(testHarness, [serverName]);
      const payload = { items: [], isStrict: false };
      const envelope = wrapInEnvelope({ payload });
      const socketId = testHarness.mockHubServer.getConnectedClients()[0];
      testHarness.mockHubServer.emitToClient(
        socketId!,
        "set-catalog",
        envelope,
      );
    });

    it("server connects despite missing env vars when catalog is not strict", async () => {
      const response = await addServer(serverName, {
        MISSING_VAR: { fromEnv: "NON_EXISTENT_ENV_VAR" },
      });
      expect(response.status).toBe(201);

      const client =
        testHarness.services.targetClients.clientsByService.get(serverName);

      // In non-strict mode, server should be connected (not pending-input)
      // Missing env vars are silently skipped for sandbox compatibility
      expect(client).toBeDefined();
      expect(client?._state).toBe("connected");
    });
  });
});
