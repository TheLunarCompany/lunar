import { resetEnv } from "../src/env.js";
import { TargetServer } from "../src/model/target-servers.js";
import { TESTKIT_SERVER_ENV_READER } from "../src/testkit/root.js";
import { getTestHarness } from "./utils.js";

const TEST_SECRET_VALUE = "super-secret-value-12345";
const TEST_ENV_VAR_NAME = "IT_TEST_SECRET_FOR_FROM_ENV";
const INHERITED_ENV_VAR_NAME = "IT_TEST_INHERITED_VAR";
const INHERITED_ENV_VALUE = "inherited-value-xyz";
const OVERRIDE_VAR_NAME = "IT_TEST_OVERRIDE_VAR";
const OVERRIDE_PROCESS_VALUE = "from-process-env";
const OVERRIDE_EXPLICIT_VALUE = "from-explicit-config";

const envReaderWithFromEnv: TargetServer = {
  type: "stdio",
  name: "env-reader-fromenv",
  command: "node",
  args: [TESTKIT_SERVER_ENV_READER],
  env: {
    MY_SECRET: { fromEnv: TEST_ENV_VAR_NAME },
    DIRECT_VALUE: "direct-string-value",
  },
};

const envReaderMinimal: TargetServer = {
  type: "stdio",
  name: "env-reader-minimal",
  command: "node",
  args: [TESTKIT_SERVER_ENV_READER],
  env: {
    EXPLICIT_ONLY: "explicit-value",
    [OVERRIDE_VAR_NAME]: OVERRIDE_EXPLICIT_VALUE,
  },
};

describe("fromEnv Resolution (STDIO_INHERIT_PROCESS_ENV=false)", () => {
  const originalEnv = process.env[TEST_ENV_VAR_NAME];
  const originalInheritedEnv = process.env[INHERITED_ENV_VAR_NAME];

  beforeAll(() => {
    process.env[TEST_ENV_VAR_NAME] = TEST_SECRET_VALUE;
    process.env[INHERITED_ENV_VAR_NAME] = INHERITED_ENV_VALUE;
    process.env["STDIO_INHERIT_PROCESS_ENV"] = "false";
    resetEnv();
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env[TEST_ENV_VAR_NAME] = originalEnv;
    } else {
      delete process.env[TEST_ENV_VAR_NAME];
    }
    if (originalInheritedEnv !== undefined) {
      process.env[INHERITED_ENV_VAR_NAME] = originalInheritedEnv;
    } else {
      delete process.env[INHERITED_ENV_VAR_NAME];
    }
  });

  describe("fromEnv resolution", () => {
    const testHarness = getTestHarness({
      targetServers: [envReaderWithFromEnv],
    });

    beforeAll(async () => {
      await testHarness.initialize("StreamableHTTP");
    });

    afterAll(async () => {
      await testHarness.shutdown();
    });

    it("resolves fromEnv reference to actual env value at spawn time", async () => {
      const result = await testHarness.client.callTool({
        name: "env-reader-fromenv__getEnv",
        arguments: { name: "MY_SECRET" },
      });

      expect(result.content).toEqual([
        { type: "text", text: TEST_SECRET_VALUE },
      ]);
    });

    it("passes through direct string env values unchanged", async () => {
      const result = await testHarness.client.callTool({
        name: "env-reader-fromenv__getEnv",
        arguments: { name: "DIRECT_VALUE" },
      });

      expect(result.content).toEqual([
        { type: "text", text: "direct-string-value" },
      ]);
    });
  });

  describe("process.env isolation", () => {
    const testHarness = getTestHarness({
      targetServers: [envReaderMinimal],
    });

    beforeAll(async () => {
      await testHarness.initialize("StreamableHTTP");
    });

    afterAll(async () => {
      await testHarness.shutdown();
    });

    it("does NOT inherit parent process.env vars when STDIO_INHERIT_PROCESS_ENV=false", async () => {
      const result = await testHarness.client.callTool({
        name: "env-reader-minimal__getEnv",
        arguments: { name: INHERITED_ENV_VAR_NAME },
      });

      expect(result.content).toEqual([
        { type: "text", text: `ENV_NOT_FOUND:${INHERITED_ENV_VAR_NAME}` },
      ]);
    });

    it("still receives explicitly configured env vars", async () => {
      const result = await testHarness.client.callTool({
        name: "env-reader-minimal__getEnv",
        arguments: { name: "EXPLICIT_ONLY" },
      });

      expect(result.content).toEqual([
        { type: "text", text: "explicit-value" },
      ]);
    });
  });
});

describe("process.env inheritance (STDIO_INHERIT_PROCESS_ENV=true)", () => {
  const originalInheritedEnv = process.env[INHERITED_ENV_VAR_NAME];
  const originalOverrideEnv = process.env[OVERRIDE_VAR_NAME];

  beforeAll(() => {
    process.env[INHERITED_ENV_VAR_NAME] = INHERITED_ENV_VALUE;
    process.env[OVERRIDE_VAR_NAME] = OVERRIDE_PROCESS_VALUE;
    process.env["STDIO_INHERIT_PROCESS_ENV"] = "true";
    resetEnv();
  });

  afterAll(() => {
    if (originalInheritedEnv !== undefined) {
      process.env[INHERITED_ENV_VAR_NAME] = originalInheritedEnv;
    } else {
      delete process.env[INHERITED_ENV_VAR_NAME];
    }
    if (originalOverrideEnv !== undefined) {
      process.env[OVERRIDE_VAR_NAME] = originalOverrideEnv;
    } else {
      delete process.env[OVERRIDE_VAR_NAME];
    }
    // Reset back to default
    process.env["STDIO_INHERIT_PROCESS_ENV"] = "false";
    resetEnv();
  });

  const testHarness = getTestHarness({
    targetServers: [envReaderMinimal],
  });

  beforeAll(async () => {
    await testHarness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await testHarness.shutdown();
  });

  it("inherits parent process.env vars when STDIO_INHERIT_PROCESS_ENV=true", async () => {
    const result = await testHarness.client.callTool({
      name: "env-reader-minimal__getEnv",
      arguments: { name: INHERITED_ENV_VAR_NAME },
    });

    expect(result.content).toEqual([
      { type: "text", text: INHERITED_ENV_VALUE },
    ]);
  });

  it("explicit env vars override inherited ones", async () => {
    // process.env has OVERRIDE_VAR_NAME = "from-process-env"
    // but explicit config has OVERRIDE_VAR_NAME = "from-explicit-config"
    // child should see the explicit value, not the inherited one
    const result = await testHarness.client.callTool({
      name: "env-reader-minimal__getEnv",
      arguments: { name: OVERRIDE_VAR_NAME },
    });

    expect(result.content).toEqual([
      { type: "text", text: OVERRIDE_EXPLICIT_VALUE },
    ]);
  });
});
