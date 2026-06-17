import { noOpLogger } from "@mcpx/toolkit-core/logging";
import {
  FailedToConnectToTargetServer,
  STDIO_SERVERS_DISABLED_MESSAGE,
} from "../errors.js";
import { resetEnv } from "../env.js";
import { TargetServer } from "../model/target-servers.js";
import { ExtendedClientBuilder } from "./client-extension.js";
import { TargetServerEnvSource } from "./env-var-manager.js";
import { IdentityServiceI } from "./identity-service.js";
import { TargetServerConnectionFactory } from "./target-server-connection-factory.js";

// The gate short-circuits before any dependency is touched, so stubs suffice.
function buildFactory(): TargetServerConnectionFactory {
  return new TargetServerConnectionFactory(
    {} as unknown as ExtendedClientBuilder,
    noOpLogger,
    {} as unknown as IdentityServiceI,
    {} as unknown as TargetServerEnvSource,
  );
}

const stdioServer = {
  name: "probe",
  type: "stdio",
  command: "npx",
  args: ["-y", "some-server"],
} as TargetServer;

describe("TargetServerConnectionFactory — ENABLE_STDIO_MCP_SERVERS gate", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv, VERSION: "1.0.0", INSTANCE_ID: "0" };
    resetEnv();
  });

  it("refuses to start a stdio server when the flag is false", async () => {
    process.env = {
      ...originalEnv,
      VERSION: "1.0.0",
      INSTANCE_ID: "0",
      ENABLE_STDIO_MCP_SERVERS: "false",
    };
    resetEnv();

    const promise = buildFactory().createConnection(stdioServer, undefined);
    await expect(promise).rejects.toBeInstanceOf(FailedToConnectToTargetServer);
    await expect(promise).rejects.toThrow(STDIO_SERVERS_DISABLED_MESSAGE);
  });

  it("does not block stdio on the disabled path when the flag defaults to true", async () => {
    process.env = { ...originalEnv, VERSION: "1.0.0", INSTANCE_ID: "0" };
    resetEnv();

    // With the gate open the connection proceeds past the guard and fails for
    // other reasons (stub deps) - it must NOT be the "disabled" rejection.
    await expect(
      buildFactory().createConnection(stdioServer, undefined),
    ).rejects.not.toThrow(STDIO_SERVERS_DISABLED_MESSAGE);
  });
});
