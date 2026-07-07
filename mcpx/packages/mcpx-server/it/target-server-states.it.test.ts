import { v7 as uuidv7 } from "uuid";
import { resetEnv } from "../src/env.js";
import { TESTKIT_SERVER_ENV_READER } from "../src/testkit/root.js";
import { getTestHarness } from "./utils.js";
import { EnvRequirements, EnvValue } from "@mcpx/shared-model";

const MCPX_BASE_URL = "http://localhost:9000";
const RECOVERY_ENV_VAR_NAME = "IT_TEST_RECOVERY_VAR";
const RECOVERY_ENV_VALUE = "recovered-value";

// Hardcoded catalog item IDs for servers with requirements
const RECOVERABLE_SERVER_ID = "550e8400-e29b-41d4-a716-446655440001";
const EMPTY_LITERAL_SERVER_ID = "550e8400-e29b-41d4-a716-446655440002";
const NULL_LITERAL_SERVER_ID = "550e8400-e29b-41d4-a716-446655440003";
const REMOTE_PENDING_SERVER_ID = "550e8400-e29b-41d4-a716-446655440004";

// Used to add a target server via API, like UI does (REST and WS both use the same underlying engine)
async function addServer(
  name: string,
  env: Record<string, string | { fromEnv: string } | null>,
  catalogItemId?: string,
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
      catalogItemId,
    }),
  });
}

async function addRemoteServer(
  name: string,
  headers: Record<string, EnvValue>,
): Promise<Response> {
  return fetch(`${MCPX_BASE_URL}/target-server`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      type: "streamable-http",
      url: "http://example.com/mcp",
      headers,
    }),
  });
}

// Build catalog payload for specified servers
function buildCatalogPayload(
  servers: Record<string, EnvRequirements | undefined>,
  serverIds?: Record<string, string>,
) {
  return {
    items: Object.entries(servers).map(([name, envRequirements]) => {
      const id = serverIds?.[name] || uuidv7();
      return {
        server: {
          id,
          name,
          displayName: name,
          config: {
            type: "stdio" as const,
            command: "node" as const,
            args: [TESTKIT_SERVER_ENV_READER],
            env: envRequirements,
          },
        },
      };
    }),
  };
}

describe("Target Server States - pending-input", () => {
  const testHarness = getTestHarness({ targetServers: [] });

  beforeAll(async () => {
    process.env["STDIO_INHERIT_PROCESS_ENV"] = "false";
    resetEnv();

    await testHarness.initialize("StreamableHTTP");

    // Include all server names that will be used in tests
    // Note: strict mode is enabled by default (mock hub sends user/member identity)
    const stdioPayload = buildCatalogPayload(
      {
        "recoverable-server": {
          REQUIRED_VAR: { kind: "required", isSecret: false },
        },
        "empty-literal-server": {
          EMPTY_REQUIRED: { kind: "required", isSecret: false },
          EMPTY_OPTIONAL: { kind: "optional", isSecret: false },
          VALID_VAR: { kind: "optional", isSecret: false },
        },
        "null-env-server": undefined,
        "null-literal-server": {
          NULL_REQUIRED: { kind: "required", isSecret: false },
          NULL_OPTIONAL: { kind: "optional", isSecret: false },
          VALID_VAR: { kind: "optional", isSecret: false },
        },
        "multi-missing-server": undefined,
      },
      {
        "recoverable-server": RECOVERABLE_SERVER_ID,
        "empty-literal-server": EMPTY_LITERAL_SERVER_ID,
        "null-literal-server": NULL_LITERAL_SERVER_ID,
      },
    );
    testHarness.emitCatalog({
      items: [
        ...stdioPayload.items,
        {
          server: {
            id: REMOTE_PENDING_SERVER_ID,
            name: "remote-pending-server",
            displayName: "remote-pending-server",
            config: {
              type: "streamable-http" as const,
              url: "http://example.com/mcp",
            },
          },
        },
      ],
    });
  });

  afterAll(async () => {
    await testHarness.shutdown();
    process.env["STDIO_INHERIT_PROCESS_ENV"] = "false";
    resetEnv();
  });

  describe("recovery from pending-input state", () => {
    const serverName = "recoverable-server";

    beforeEach(async () => {
      const response = await addServer(
        serverName,
        {
          REQUIRED_VAR: { fromEnv: RECOVERY_ENV_VAR_NAME },
        },
        RECOVERABLE_SERVER_ID,
      );
      expect(response.status).toBe(201);
    });

    afterEach(async () => {
      await fetch(`${MCPX_BASE_URL}/target-server/${serverName}`, {
        method: "DELETE",
      });
    });

    it("server starts in pending-input state when fromEnv reference is missing", () => {
      const client =
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

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
        testHarness.services.upstreamHandler.clientsByService.get(serverName);
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
        testHarness.services.upstreamHandler.clientsByService.get(serverName);
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

  describe("empty literal string handling by requirement kind", () => {
    const serverName = "empty-literal-server";

    beforeAll(async () => {
      const response = await addServer(
        serverName,
        {
          EMPTY_REQUIRED: "",
          EMPTY_OPTIONAL: "",
          VALID_VAR: "valid-value",
        },
        EMPTY_LITERAL_SERVER_ID,
      );
      expect(response.status).toBe(201);
    });

    it("required empty string is reported as missing", () => {
      const client =
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

      expect(client).toBeDefined();
      expect(client?._state).toBe("pending-input");
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([{ key: "EMPTY_REQUIRED", type: "literal" }]);
    });

    it("optional empty string is silently skipped (not reported)", () => {
      const client =
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

      // Only EMPTY_REQUIRED should be reported; EMPTY_OPTIONAL is skipped
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([{ key: "EMPTY_REQUIRED", type: "literal" }]);
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
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

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

  describe("null value handling by requirement kind", () => {
    const serverName = "null-literal-server";

    beforeAll(async () => {
      const response = await addServer(
        serverName,
        {
          NULL_REQUIRED: null,
          NULL_OPTIONAL: null,
          VALID_VAR: "valid-value",
        },
        NULL_LITERAL_SERVER_ID,
      );
      expect(response.status).toBe(201);
    });

    it("required null is reported as missing", () => {
      const client =
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

      expect(client).toBeDefined();
      expect(client?._state).toBe("pending-input");
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([{ key: "NULL_REQUIRED", type: "literal" }]);
    });

    it("optional null is silently skipped (not reported)", () => {
      const client =
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

      // Only NULL_REQUIRED should be reported; NULL_OPTIONAL is skipped
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([{ key: "NULL_REQUIRED", type: "literal" }]);
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
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

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
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

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
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

      expect(client?._state).toBe("connected");
    });
  });

  describe("remote server header pending-input", () => {
    const serverName = "remote-pending-server";

    afterEach(async () => {
      await fetch(`${MCPX_BASE_URL}/target-server/${serverName}`, {
        method: "DELETE",
      });
    });

    it("fromEnv-backed header with missing env var → pending-input", async () => {
      const response = await addRemoteServer(serverName, {
        Authorization: { fromEnv: "MISSING_HEADER_VAR" },
      });
      expect(response.status).toBe(201);

      const client =
        testHarness.services.upstreamHandler.clientsByService.get(serverName);
      expect(client).toBeDefined();
      expect(client?._state).toBe("pending-input");
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([
        {
          key: "Authorization",
          type: "fromEnv",
          fromEnvName: "MISSING_HEADER_VAR",
        },
      ]);
    });

    it("param-template header with missing env var → pending-input", async () => {
      const response = await addRemoteServer(serverName, {
        Authorization: "Bearer {{MISSING_TOKEN}}",
      });
      expect(response.status).toBe(201);

      const client =
        testHarness.services.upstreamHandler.clientsByService.get(serverName);
      expect(client).toBeDefined();
      expect(client?._state).toBe("pending-input");
      expect(
        client?._state === "pending-input" && client.missingEnvVars,
      ).toEqual([
        { key: "Authorization", type: "fromEnv", fromEnvName: "MISSING_TOKEN" },
      ]);
    });
  });

  describe("non-strict mode skips pending-input (space identity)", () => {
    const serverName = "non-strict-server";

    beforeAll(async () => {
      // Switch to non-strict mode by setting space identity
      testHarness.emitIdentity({ entityType: "space" });
      testHarness.emitCatalog(
        buildCatalogPayload({
          [serverName]: undefined,
        }),
      );
    });

    it("server connects despite missing env vars when identity is space (non-strict)", async () => {
      const response = await addServer(serverName, {
        MISSING_VAR: { fromEnv: "NON_EXISTENT_ENV_VAR" },
      });
      expect(response.status).toBe(201);

      const client =
        testHarness.services.upstreamHandler.clientsByService.get(serverName);

      // In non-strict mode (space identity), server should be connected (not pending-input)
      // Missing env vars are silently skipped when not in strict mode
      expect(client).toBeDefined();
      expect(client?._state).toBe("connected");
    });
  });
});
