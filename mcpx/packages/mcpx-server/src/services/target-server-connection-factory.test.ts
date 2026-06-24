import { noOpLogger } from "@mcpx/toolkit-core/logging";
import {
  FailedToConnectToTargetServer,
  PendingInputError,
  STDIO_SERVERS_DISABLED_MESSAGE,
} from "../errors.js";
import { resetEnv } from "../env.js";
import { TargetServer } from "../model/target-servers.js";
import { ExtendedClientBuilder } from "./client-extension.js";
import {
  TargetServerEnvResolver,
  TargetServerEnvSource,
} from "./env-var-manager.js";
import { IdentityServiceI } from "./identity-service.js";
import {
  resolveRemoteHeaders,
  TargetServerConnectionFactory,
} from "./target-server-connection-factory.js";

const processEnvResolver: TargetServerEnvResolver = {
  resolveTargetServerEnv: (name) => process.env[name],
};

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

describe("resolveRemoteHeaders", () => {
  const base = {
    logger: noOpLogger,
    isSpace: false,
    envVarsResolver: processEnvResolver,
  };

  it("merges watermark headers alongside user headers", () => {
    const headers = resolveRemoteHeaders({
      ...base,
      userHeaders: { "X-User": "user-value" },
      privateHeaders: { key: "X-MCPX-Watermark", value: "secret" },
    });

    expect(headers).toEqual({
      "X-User": "user-value",
      "X-MCPX-Watermark": "secret",
    });
  });

  it("lets watermark headers win over a user header of the same name", () => {
    const headers = resolveRemoteHeaders({
      ...base,
      userHeaders: { "X-Shared": "user-wins?" },
      privateHeaders: { key: "X-Shared", value: "admin-wins" },
    });

    expect(headers?.["X-Shared"]).toBe("admin-wins");
  });

  it("returns only user headers when no watermark is set", () => {
    const headers = resolveRemoteHeaders({
      ...base,
      userHeaders: { "X-User": "user-value" },
    });

    expect(headers).toEqual({ "X-User": "user-value" });
  });

  it("returns only watermark headers when there are no user headers", () => {
    const headers = resolveRemoteHeaders({
      ...base,
      privateHeaders: { key: "X-MCPX-Watermark", value: "secret" },
    });

    expect(headers).toEqual({ "X-MCPX-Watermark": "secret" });
  });

  it("returns undefined when there are no headers at all", () => {
    expect(resolveRemoteHeaders(base)).toBeUndefined();
  });

  it("passes the watermark header through verbatim without env resolution", () => {
    process.env["LOOKS_LIKE_ENV"] = "should-not-be-used";
    try {
      const headers = resolveRemoteHeaders({
        ...base,
        privateHeaders: { key: "X-MCPX-Watermark", value: "LOOKS_LIKE_ENV" },
      });
      expect(headers).toEqual({ "X-MCPX-Watermark": "LOOKS_LIKE_ENV" });
    } finally {
      delete process.env["LOOKS_LIKE_ENV"];
    }
  });

  it("resolves env-backed user header values", () => {
    process.env["USER_HEADER_FROM_ENV"] = "resolved-secret";
    try {
      const headers = resolveRemoteHeaders({
        ...base,
        userHeaders: {
          "X-User-Env": { fromEnv: "USER_HEADER_FROM_ENV" },
        },
      });
      expect(headers).toEqual({ "X-User-Env": "resolved-secret" });
    } finally {
      delete process.env["USER_HEADER_FROM_ENV"];
    }
  });

  it("throws when an env-backed user header is missing and the identity is not a space", () => {
    expect(() =>
      resolveRemoteHeaders({
        ...base,
        userHeaders: { "X-User-Env": { fromEnv: "MISSING_ENV" } },
      }),
    ).toThrow(PendingInputError);
  });

  it("tolerates a missing env-backed user header for a space", () => {
    const headers = resolveRemoteHeaders({
      logger: noOpLogger,
      isSpace: true,
      envVarsResolver: processEnvResolver,
      userHeaders: { "X-User-Env": { fromEnv: "MISSING_ENV" } },
    });

    expect(headers).toEqual({});
  });
});

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
