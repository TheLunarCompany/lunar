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
      API_KEY: "direct-value",
      DEBUG: "true",
    });
  });

  it("resolves fromEnv references from process.env", () => {
    process.env["ACTUAL_API_KEY"] = "secret-value";

    const envConfig = {
      API_KEY: { fromEnv: "ACTUAL_API_KEY" },
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result).toEqual({
      API_KEY: "secret-value",
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
      DIRECT_VAR: "direct",
      RESOLVED_VAR: "token-value",
      ANOTHER_DIRECT: "another",
    });
  });

  it("skips missing env vars (does not include them in result)", () => {
    const envConfig = {
      EXISTING: "value",
      MISSING: { fromEnv: "NON_EXISTENT_VAR" },
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result).toEqual({
      EXISTING: "value",
    });
    expect(result).not.toHaveProperty("MISSING");
  });

  it("returns empty object for empty config", () => {
    const result = resolveEnvValues({}, noOpLogger);

    expect(result).toEqual({});
  });

  it("handles empty string values correctly", () => {
    process.env["EMPTY_VAR"] = "";

    const envConfig = {
      DIRECT_EMPTY: "",
      RESOLVED_EMPTY: { fromEnv: "EMPTY_VAR" },
    };

    const result = resolveEnvValues(envConfig, noOpLogger);

    expect(result).toEqual({
      DIRECT_EMPTY: "",
      RESOLVED_EMPTY: "",
    });
  });
});
