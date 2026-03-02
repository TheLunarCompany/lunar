import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { resolveEnvValues } from "./target-server-connection-factory.js";

describe("resolveEnvValues", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("passes through direct string values", () => {
    const envConfig = {
      API_KEY: "direct-value",
      DEBUG: "true",
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result).toEqual({
      resolved: {
        API_KEY: "direct-value",
        DEBUG: "true",
      },
      missingVars: [],
    });
  });

  it("resolves fromEnv references from process.env", () => {
    process.env["ACTUAL_API_KEY"] = "secret-value";

    const envConfig = {
      API_KEY: { fromEnv: "ACTUAL_API_KEY" },
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result).toEqual({
      resolved: {
        API_KEY: "secret-value",
      },
      missingVars: [],
    });
  });

  it("handles mixed direct values and fromEnv references", () => {
    process.env["SECRET_TOKEN"] = "token-value";

    const envConfig = {
      DIRECT_VAR: "direct",
      RESOLVED_VAR: { fromEnv: "SECRET_TOKEN" },
      ANOTHER_DIRECT: "another",
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result).toEqual({
      resolved: {
        DIRECT_VAR: "direct",
        RESOLVED_VAR: "token-value",
        ANOTHER_DIRECT: "another",
      },
      missingVars: [],
    });
  });

  it("reports missing fromEnv references in missingVars", () => {
    const envConfig = {
      EXISTING: "value",
      MISSING: { fromEnv: "NON_EXISTENT_VAR" },
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result.resolved).toEqual({ EXISTING: "value" });
    expect(result.missingVars).toEqual([
      { key: "MISSING", type: "fromEnv", fromEnvName: "NON_EXISTENT_VAR" },
    ]);
  });

  it("returns empty object for empty config", () => {
    const result = resolveEnvValues({}, noOpLogger);

    expect(result).toEqual({ resolved: {}, missingVars: [] });
  });

  it("reports empty string literals as missing vars", () => {
    const envConfig = {
      DIRECT_EMPTY: "",
      VALID_VALUE: "valid",
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result.resolved).toEqual({ VALID_VALUE: "valid" });
    expect(result.missingVars).toEqual([
      { key: "DIRECT_EMPTY", type: "literal" },
    ]);
  });

  it("reports empty fromEnv references as missing vars", () => {
    process.env["EMPTY_VAR"] = "";

    const envConfig = {
      RESOLVED_EMPTY: { fromEnv: "EMPTY_VAR" },
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result.resolved).toEqual({});
    expect(result.missingVars).toEqual([
      { key: "RESOLVED_EMPTY", type: "fromEnv", fromEnvName: "EMPTY_VAR" },
    ]);
  });

  it("skips null values (intentionally empty)", () => {
    const envConfig = {
      INTENTIONALLY_EMPTY: null,
      VALID_VALUE: "valid",
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result).toEqual({
      resolved: { VALID_VALUE: "valid" },
      missingVars: [],
    });
  });
});
