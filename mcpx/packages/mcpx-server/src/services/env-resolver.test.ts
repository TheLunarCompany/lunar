import { describe, it, expect } from "@jest/globals";
import { enforceFixedEnvVars } from "./env-resolver.js";
import { EnvRequirements, EnvValue } from "@mcpx/shared-model";

function buildEnvRequirement(
  kind: "fixed" | "required" | "optional",
  prefilled: EnvValue = "fixedEnforcedByCatalog",
):
  | { kind: "required"; isSecret: false }
  | { kind: "optional"; isSecret: false }
  | { kind: "fixed"; isSecret: false; prefilled: EnvValue } {
  if (kind === "required") return { kind, isSecret: false };
  if (kind === "optional") return { kind, isSecret: false };
  return { kind, isSecret: false, prefilled };
}

describe("enforceFixedEnvVars", () => {
  describe("with no requirements", () => {
    it("returns env unchanged when requirements is undefined", () => {
      const env = { FOO: "user-value" };
      expect(enforceFixedEnvVars(env, undefined)).toEqual({
        FOO: "user-value",
      });
    });
  });

  describe("with fixed requirements", () => {
    it("overrides env value with fixed prefilled value", () => {
      const env: Record<string, EnvValue> = { API_KEY: "user-provided" };
      const requirements: EnvRequirements = {
        API_KEY: buildEnvRequirement("fixed"),
      };
      expect(enforceFixedEnvVars(env, requirements)).toEqual({
        API_KEY: "fixedEnforcedByCatalog",
      });
    });

    it("injects fixed var even when not present in env", () => {
      const env: Record<string, EnvValue> = {};
      const requirements: EnvRequirements = {
        API_KEY: buildEnvRequirement("fixed"),
      };
      expect(enforceFixedEnvVars(env, requirements)).toEqual({
        API_KEY: "fixedEnforcedByCatalog",
      });
    });

    it("supports fromEnv as the fixed prefilled value", () => {
      const env: Record<string, EnvValue> = { TOKEN: "user-value" };
      const requirements: EnvRequirements = {
        TOKEN: buildEnvRequirement("fixed", { fromEnv: "SYSTEM_TOKEN" }),
      };
      expect(enforceFixedEnvVars(env, requirements)).toEqual({
        TOKEN: { fromEnv: "SYSTEM_TOKEN" },
      });
    });

    it("supports fromSecret as the fixed prefilled value", () => {
      const env: Record<string, EnvValue> = {};
      const requirements: EnvRequirements = {
        SECRET: buildEnvRequirement("fixed", { fromSecret: "vault/my-secret" }),
      };
      expect(enforceFixedEnvVars(env, requirements)).toEqual({
        SECRET: { fromSecret: "vault/my-secret" },
      });
    });
  });

  describe("with required and optional requirements", () => {
    it("does not override required vars", () => {
      const env: Record<string, EnvValue> = { API_KEY: "user-provided" };
      const requirements: EnvRequirements = {
        API_KEY: buildEnvRequirement("required"),
      };
      expect(enforceFixedEnvVars(env, requirements)).toEqual({
        API_KEY: "user-provided",
      });
    });

    it("does not override optional vars", () => {
      const env: Record<string, EnvValue> = { REGION: "us-east-1" };
      const requirements: EnvRequirements = {
        REGION: buildEnvRequirement("optional"),
      };
      expect(enforceFixedEnvVars(env, requirements)).toEqual({
        REGION: "us-east-1",
      });
    });
  });

  describe("with mixed requirements", () => {
    it("overrides only fixed vars, preserves user values for others", () => {
      const env: Record<string, EnvValue> = {
        FIXED_KEY: "user-should-be-overridden",
        REQUIRED_KEY: "user-required",
        OPTIONAL_KEY: "user-optional",
      };
      const requirements: EnvRequirements = {
        FIXED_KEY: buildEnvRequirement("fixed"),
        REQUIRED_KEY: buildEnvRequirement("required"),
        OPTIONAL_KEY: buildEnvRequirement("optional"),
      };
      expect(enforceFixedEnvVars(env, requirements)).toEqual({
        FIXED_KEY: "fixedEnforcedByCatalog",
        REQUIRED_KEY: "user-required",
        OPTIONAL_KEY: "user-optional",
      });
    });

    it("preserves env vars not mentioned in requirements", () => {
      const env: Record<string, EnvValue> = {
        UNRELATED: "preserved",
        FIXED_KEY: "override-me",
      };
      const requirements: EnvRequirements = {
        FIXED_KEY: buildEnvRequirement("fixed"),
      };
      expect(enforceFixedEnvVars(env, requirements)).toEqual({
        UNRELATED: "preserved",
        FIXED_KEY: "fixedEnforcedByCatalog",
      });
    });
  });
});
