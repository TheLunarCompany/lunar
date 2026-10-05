import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { EnvRequirement, EnvRequirements } from "@mcpx/shared-model";
import { PendingInputError } from "../errors.js";
import { EnvValue } from "../model/target-servers.js";
import { TargetServerEnvResolver } from "./env-var-manager.js";
import {
  resolveEnv,
  resolveHeadersValues,
  ResolveEnvResult,
} from "./target-server-env-resolution.js";

// --- Helpers ---

// Adapter so existing tests can keep mutating process.env;
// mirrors EnvVarManager's process.env fallback.
const processEnvResolver: TargetServerEnvResolver = {
  resolveTargetServerEnv: (name) => process.env[name],
};

function run(args: {
  envConfig: Record<string, EnvValue>;
  envRequirements?: EnvRequirements;
}): ResolveEnvResult {
  return resolveEnv({
    ...args,
    envVarsResolver: processEnvResolver,
    logger: noOpLogger,
  });
}

function runHeaders(args: {
  headers: Record<string, EnvValue>;
  isSpace?: boolean;
}): Record<string, string> {
  const { resolved, missingVars } = resolveHeadersValues({
    headers: args.headers,
    envVarsResolver: processEnvResolver,
    logger: noOpLogger,
  });
  if (missingVars.length > 0 && !(args.isSpace ?? false)) {
    throw new PendingInputError(missingVars);
  }
  return resolved;
}

function required(prefilled?: EnvValue): EnvRequirement {
  return {
    kind: "required",
    isSecret: false,
    ...(prefilled !== undefined ? { prefilled } : {}),
  };
}

function optional(prefilled?: EnvValue): EnvRequirement {
  return {
    kind: "optional",
    isSecret: false,
    ...(prefilled !== undefined ? { prefilled } : {}),
  };
}

function fixed(prefilled: EnvValue): EnvRequirement {
  return { kind: "fixed", prefilled, isSecret: false };
}

describe("resolveEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ============================================================
  // Per-kind: REQUIRED
  // ============================================================
  describe("required", () => {
    describe("literal value", () => {
      it("non-empty string → resolved", () => {
        const result = run({
          envConfig: { FOO: "value" },
          envRequirements: { FOO: required() },
        });
        expect(result.resolved).toEqual({ FOO: "value" });
        expect(result.missingVars).toEqual([]);
      });

      it("null → missing literal", () => {
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: required() },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([{ key: "FOO", type: "literal" }]);
      });

      it("empty string → missing literal", () => {
        const result = run({
          envConfig: { FOO: "" },
          envRequirements: { FOO: required() },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([{ key: "FOO", type: "literal" }]);
      });

      it("whitespace-only string → missing literal", () => {
        const result = run({
          envConfig: { FOO: "   " },
          envRequirements: { FOO: required() },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([{ key: "FOO", type: "literal" }]);
      });
    });

    describe("fromEnv", () => {
      it("process.env has value → resolved with that value", () => {
        process.env["X"] = "x-value";
        const result = run({
          envConfig: { FOO: { fromEnv: "X" } },
          envRequirements: { FOO: required() },
        });
        expect(result.resolved).toEqual({ FOO: "x-value" });
        expect(result.missingVars).toEqual([]);
      });

      it("process.env undefined → missing fromEnv", () => {
        delete process.env["X"]; // just to make sure
        const result = run({
          envConfig: { FOO: { fromEnv: "X" } },
          envRequirements: { FOO: required() },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "X" },
        ]);
      });

      it("process.env empty string → missing fromEnv", () => {
        process.env["X"] = "";
        const result = run({
          envConfig: { FOO: { fromEnv: "X" } },
          envRequirements: { FOO: required() },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "X" },
        ]);
      });

      it("process.env whitespace-only → missing fromEnv", () => {
        process.env["X"] = "   ";
        const result = run({
          envConfig: { FOO: { fromEnv: "X" } },
          envRequirements: { FOO: required() },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "X" },
        ]);
      });
    });

    describe("fromSecret (resolved like fromEnv; missing reported as type 'fromEnv')", () => {
      it("process.env has value → resolved", () => {
        process.env["S"] = "secret-value";
        const result = run({
          envConfig: { FOO: { fromSecret: "S" } },
          envRequirements: { FOO: required() },
        });
        expect(result.resolved).toEqual({ FOO: "secret-value" });
        expect(result.missingVars).toEqual([]);
      });

      it("process.env undefined → missing fromEnv with secret name", () => {
        delete process.env["S"];
        const result = run({
          envConfig: { FOO: { fromSecret: "S" } },
          envRequirements: { FOO: required() },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "S" },
        ]);
      });

      it("process.env empty → missing fromEnv with secret name", () => {
        process.env["S"] = "";
        const result = run({
          envConfig: { FOO: { fromSecret: "S" } },
          envRequirements: { FOO: required() },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "S" },
        ]);
      });
    });
  });

  // ============================================================
  // Per-kind: OPTIONAL
  // ============================================================
  describe("optional", () => {
    describe("literal value", () => {
      it("non-empty string → resolved", () => {
        const result = run({
          envConfig: { FOO: "value" },
          envRequirements: { FOO: optional() },
        });
        expect(result.resolved).toEqual({ FOO: "value" });
        expect(result.missingVars).toEqual([]);
      });

      it("null → silently skipped (intentional opt-out)", () => {
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: optional() },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([]);
      });

      it("empty string → silently skipped", () => {
        const result = run({
          envConfig: { FOO: "" },
          envRequirements: { FOO: optional() },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([]);
      });

      it("whitespace-only string → silently skipped", () => {
        const result = run({
          envConfig: { FOO: "   " },
          envRequirements: { FOO: optional() },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([]);
      });
    });

    describe("fromEnv", () => {
      it("process.env has value → resolved", () => {
        process.env["X"] = "x-value";
        const result = run({
          envConfig: { FOO: { fromEnv: "X" } },
          envRequirements: { FOO: optional() },
        });
        expect(result.resolved).toEqual({ FOO: "x-value" });
        expect(result.missingVars).toEqual([]);
      });

      it("process.env undefined → missing fromEnv (failed reference always surfaces)", () => {
        delete process.env["X"];
        const result = run({
          envConfig: { FOO: { fromEnv: "X" } },
          envRequirements: { FOO: optional() },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "X" },
        ]);
      });

      it("process.env empty → missing fromEnv", () => {
        process.env["X"] = "";
        const result = run({
          envConfig: { FOO: { fromEnv: "X" } },
          envRequirements: { FOO: optional() },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "X" },
        ]);
      });
    });

    describe("fromSecret", () => {
      it("process.env has value → resolved", () => {
        process.env["S"] = "secret-value";
        const result = run({
          envConfig: { FOO: { fromSecret: "S" } },
          envRequirements: { FOO: optional() },
        });
        expect(result.resolved).toEqual({ FOO: "secret-value" });
      });

      it("process.env undefined → missing fromEnv with secret name", () => {
        delete process.env["S"];
        const result = run({
          envConfig: { FOO: { fromSecret: "S" } },
          envRequirements: { FOO: optional() },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "S" },
        ]);
      });
    });
  });

  // ============================================================
  // Per-kind: FIXED (catalog prefilled wins, user input ignored)
  // ============================================================
  describe("fixed", () => {
    describe("user input is discarded", () => {
      it("user-supplied literal differs from prefilled → prefilled wins", () => {
        const result = run({
          envConfig: { FOO: "user-value" },
          envRequirements: { FOO: fixed("admin-value") },
        });
        expect(result.resolved).toEqual({ FOO: "admin-value" });
        expect(result.missingVars).toEqual([]);
      });

      it("user supplied a fromEnv reference → prefilled still wins", () => {
        process.env["USER_X"] = "user-x-value";
        const result = run({
          envConfig: { FOO: { fromEnv: "USER_X" } },
          envRequirements: { FOO: fixed("admin-value") },
        });
        expect(result.resolved).toEqual({ FOO: "admin-value" });
      });

      it("user supplied a failing fromEnv → prefilled resolves cleanly, no missingVars from user input", () => {
        delete process.env["USER_X"];
        const result = run({
          envConfig: { FOO: { fromEnv: "USER_X" } },
          envRequirements: { FOO: fixed("admin-value") },
        });
        expect(result.resolved).toEqual({ FOO: "admin-value" });
        expect(result.missingVars).toEqual([]);
      });
    });

    describe("prefilled literal", () => {
      it("non-empty → resolved using prefilled", () => {
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: fixed("admin-value") },
        });
        expect(result.resolved).toEqual({ FOO: "admin-value" });
      });

      it("null → silently skipped", () => {
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: fixed(null) },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([]);
      });

      it("empty string → silently skipped", () => {
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: fixed("") },
        });
        expect(result.resolved).toEqual({});
        expect(result.missingVars).toEqual([]);
      });
    });

    describe("prefilled fromEnv", () => {
      it("resolves → resolved using process.env value", () => {
        process.env["ADMIN_X"] = "admin-x-value";
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: fixed({ fromEnv: "ADMIN_X" }) },
        });
        expect(result.resolved).toEqual({ FOO: "admin-x-value" });
      });

      it("unresolved → missing fromEnv with PREFILLED's reference name", () => {
        delete process.env["ADMIN_X"];
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: fixed({ fromEnv: "ADMIN_X" }) },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "ADMIN_X" },
        ]);
      });

      it("user-supplied value does NOT leak into the missing reference name", () => {
        delete process.env["ADMIN_X"];
        delete process.env["USER_X"];
        const result = run({
          envConfig: { FOO: { fromEnv: "USER_X" } },
          envRequirements: { FOO: fixed({ fromEnv: "ADMIN_X" }) },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "ADMIN_X" },
        ]);
      });
    });

    describe("prefilled fromSecret", () => {
      it("resolves → resolved", () => {
        process.env["ADMIN_S"] = "admin-secret-value";
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: fixed({ fromSecret: "ADMIN_S" }) },
        });
        expect(result.resolved).toEqual({ FOO: "admin-secret-value" });
      });

      it("unresolved → missing fromEnv with PREFILLED's secret name", () => {
        delete process.env["ADMIN_S"];
        const result = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: fixed({ fromSecret: "ADMIN_S" }) },
        });
        expect(result.missingVars).toEqual([
          { key: "FOO", type: "fromEnv", fromEnvName: "ADMIN_S" },
        ]);
      });
    });
  });

  // ============================================================
  // Per-kind: NO REQUIREMENT FOR KEY
  // (envRequirements is provided, but doesn't include this key.
  //  Failed references always surface, regardless of kind or catalog state.)
  // ============================================================
  describe("no requirement for key", () => {
    const otherKeyReq: EnvRequirements = { OTHER: optional() };

    it("non-empty literal → resolved", () => {
      const result = run({
        envConfig: { FOO: "value" },
        envRequirements: otherKeyReq,
      });
      expect(result.resolved).toEqual({ FOO: "value" });
      expect(result.missingVars).toEqual([]);
    });

    it("null → silently skipped", () => {
      const result = run({
        envConfig: { FOO: null },
        envRequirements: otherKeyReq,
      });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toEqual([]);
    });

    it("empty string → silently skipped", () => {
      const result = run({
        envConfig: { FOO: "" },
        envRequirements: otherKeyReq,
      });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toEqual([]);
    });

    it("fromEnv resolves → resolved", () => {
      process.env["X"] = "x-value";
      const result = run({
        envConfig: { FOO: { fromEnv: "X" } },
        envRequirements: otherKeyReq,
      });
      expect(result.resolved).toEqual({ FOO: "x-value" });
    });

    it("fromEnv unresolved → missing fromEnv (failed reference always surfaces)", () => {
      delete process.env["X"];
      const result = run({
        envConfig: { FOO: { fromEnv: "X" } },
        envRequirements: otherKeyReq,
      });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toEqual([
        { key: "FOO", type: "fromEnv", fromEnvName: "X" },
      ]);
    });

    it("fromSecret unresolved → missing fromEnv with secret name", () => {
      delete process.env["S"];
      const result = run({
        envConfig: { FOO: { fromSecret: "S" } },
        envRequirements: otherKeyReq,
      });
      expect(result.missingVars).toEqual([
        { key: "FOO", type: "fromEnv", fromEnvName: "S" },
      ]);
    });
  });

  // ============================================================
  // envRequirements not provided (power-user / non-catalog path)
  // Failed references always surface; null/empty are intentional opt-outs.
  // ============================================================
  describe("envRequirements not provided (power-user path)", () => {
    it("non-empty literal → resolved", () => {
      const result = run({ envConfig: { FOO: "value" } });
      expect(result.resolved).toEqual({ FOO: "value" });
      expect(result.missingVars).toEqual([]);
    });

    it("null → silently skipped (intentional opt-out)", () => {
      const result = run({ envConfig: { FOO: null } });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toEqual([]);
    });

    it("empty string → silently skipped", () => {
      const result = run({ envConfig: { FOO: "" } });
      expect(result.missingVars).toEqual([]);
    });

    it("fromEnv resolves → resolved", () => {
      process.env["X"] = "x-value";
      const result = run({ envConfig: { FOO: { fromEnv: "X" } } });
      expect(result.resolved).toEqual({ FOO: "x-value" });
    });

    it("fromEnv unresolved → missing fromEnv (failed reference always surfaces)", () => {
      delete process.env["X"];
      const result = run({ envConfig: { FOO: { fromEnv: "X" } } });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toEqual([
        { key: "FOO", type: "fromEnv", fromEnvName: "X" },
      ]);
    });

    it("fromSecret unresolved → missing fromEnv with secret name", () => {
      delete process.env["S"];
      const result = run({ envConfig: { FOO: { fromSecret: "S" } } });
      expect(result.missingVars).toEqual([
        { key: "FOO", type: "fromEnv", fromEnvName: "S" },
      ]);
    });

    it("only failed references push; null/empty are silent opt-outs", () => {
      delete process.env["A"];
      delete process.env["B"];
      const result = run({
        envConfig: {
          FOO: null,
          BAR: "",
          BAZ: { fromEnv: "A" },
          QUX: { fromSecret: "B" },
        },
      });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toHaveLength(2);
      expect(result.missingVars).toEqual(
        expect.arrayContaining([
          { key: "BAZ", type: "fromEnv", fromEnvName: "A" },
          { key: "QUX", type: "fromEnv", fromEnvName: "B" },
        ]),
      );
    });
  });

  // ============================================================
  // envRequirements has keys NOT present in envConfig
  // (the union iteration / required-but-not-supplied case)
  // ============================================================
  describe("envRequirements has keys not present in envConfig", () => {
    it("required key absent → missing literal", () => {
      const result = run({
        envConfig: {},
        envRequirements: { FOO: required() },
      });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toEqual([{ key: "FOO", type: "literal" }]);
    });

    it("optional key absent → silently skipped", () => {
      const result = run({
        envConfig: {},
        envRequirements: { FOO: optional() },
      });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toEqual([]);
    });

    it("fixed key absent + prefilled resolves → resolved using prefilled", () => {
      const result = run({
        envConfig: {},
        envRequirements: { FOO: fixed("admin-value") },
      });
      expect(result.resolved).toEqual({ FOO: "admin-value" });
      expect(result.missingVars).toEqual([]);
    });

    // This is a potentially common sad-path case - admin sets a fixed fromEnv in catalog and user does not have that env var.
    // Requires stricter coordination on webapp's end - to ensure PROFILES are carrying the right secrets (env vars) for the
    // catalog items they contain.
    it("fixed key absent + prefilled unresolved → missing fromEnv", () => {
      delete process.env["ADMIN_X"];
      const result = run({
        envConfig: {},
        envRequirements: { FOO: fixed({ fromEnv: "ADMIN_X" }) },
      });
      expect(result.missingVars).toEqual([
        { key: "FOO", type: "fromEnv", fromEnvName: "ADMIN_X" },
      ]);
    });

    it("empty envConfig + multiple required → all surface as missing literal", () => {
      const result = run({
        envConfig: {},
        envRequirements: {
          A: required(),
          B: required(),
          C: required(),
        },
      });
      expect(result.missingVars).toHaveLength(3);
      expect(result.missingVars).toEqual(
        expect.arrayContaining([
          { key: "A", type: "literal" },
          { key: "B", type: "literal" },
          { key: "C", type: "literal" },
        ]),
      );
    });

    describe("absence is equivalent to explicit empty/null", () => {
      it("required absent ≡ required null", () => {
        const absent = run({
          envConfig: {},
          envRequirements: { FOO: required() },
        });
        const explicitNull = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: required() },
        });
        expect(absent).toEqual(explicitNull);
      });

      it("required absent ≡ required empty string", () => {
        const absent = run({
          envConfig: {},
          envRequirements: { FOO: required() },
        });
        const explicitEmpty = run({
          envConfig: { FOO: "" },
          envRequirements: { FOO: required() },
        });
        expect(absent).toEqual(explicitEmpty);
      });

      it("optional absent ≡ optional null", () => {
        const absent = run({
          envConfig: {},
          envRequirements: { FOO: optional() },
        });
        const explicitNull = run({
          envConfig: { FOO: null },
          envRequirements: { FOO: optional() },
        });
        expect(absent).toEqual(explicitNull);
      });
    });
  });

  // ============================================================
  // Composition: multi-key calls with mixed verdicts
  // ============================================================
  describe("composition", () => {
    it("mixed verdicts in a single call: required-found, required-missing, optional-skipped, fixed-overridden, no-req-resolved, no-req-failed", () => {
      process.env["GOOD_REF"] = "good";
      delete process.env["BAD_REF"];
      const result = run({
        envConfig: {
          REQUIRED_OK: "ok",
          REQUIRED_MISSING: null,
          OPTIONAL_SKIPPED: null,
          FIXED_OVERRIDDEN: "user-input",
          NO_REQ_RESOLVED: { fromEnv: "GOOD_REF" },
          NO_REQ_FAILED: { fromEnv: "BAD_REF" },
        },
        envRequirements: {
          REQUIRED_OK: required(),
          REQUIRED_MISSING: required(),
          OPTIONAL_SKIPPED: optional(),
          FIXED_OVERRIDDEN: fixed("admin-input"),
        },
      });
      expect(result.resolved).toEqual({
        REQUIRED_OK: "ok",
        FIXED_OVERRIDDEN: "admin-input",
        NO_REQ_RESOLVED: "good",
      });
      expect(result.missingVars).toHaveLength(2);
      expect(result.missingVars).toEqual(
        expect.arrayContaining([
          { key: "REQUIRED_MISSING", type: "literal" },
          { key: "NO_REQ_FAILED", type: "fromEnv", fromEnvName: "BAD_REF" },
        ]),
      );
    });

    it("envConfig has key X (no req) + envRequirements has key Y (required) → both processed independently", () => {
      const result = run({
        envConfig: { X: "x-value" },
        envRequirements: { Y: required() },
      });
      expect(result.resolved).toEqual({ X: "x-value" });
      expect(result.missingVars).toEqual([{ key: "Y", type: "literal" }]);
    });

    it("optional+failed and required+failed in the same call both push", () => {
      delete process.env["OPT_REF"];
      delete process.env["REQ_REF"];
      const result = run({
        envConfig: {
          OPT: { fromEnv: "OPT_REF" },
          REQ: { fromEnv: "REQ_REF" },
        },
        envRequirements: { OPT: optional(), REQ: required() },
      });
      expect(result.resolved).toEqual({});
      expect(result.missingVars).toHaveLength(2);
      expect(result.missingVars).toEqual(
        expect.arrayContaining([
          { key: "OPT", type: "fromEnv", fromEnvName: "OPT_REF" },
          { key: "REQ", type: "fromEnv", fromEnvName: "REQ_REF" },
        ]),
      );
    });
  });

  // ============================================================
  // Boundary cases
  // ============================================================
  describe("boundaries", () => {
    it("empty envConfig + envRequirements undefined → empty result", () => {
      const result = run({ envConfig: {} });
      expect(result).toEqual({ resolved: {}, missingVars: [] });
    });

    it("empty envConfig + empty envRequirements → empty result", () => {
      const result = run({ envConfig: {}, envRequirements: {} });
      expect(result).toEqual({ resolved: {}, missingVars: [] });
    });

    it("empty envRequirements ({}) + populated envConfig → all keys go through no-requirement branch (NOT no-envRequirements path)", () => {
      // Distinguishes envRequirements: {} (truthy, runs main loop, all keys are no-req)
      // from envRequirements: undefined (falsy, runs resolveEnvNoRequirements path).
      // Both paths apply the same contract: failed references push, null/empty skip.
      delete process.env["X"];
      const result = run({
        envConfig: {
          GOOD: "value",
          NULL_VAL: null,
          BAD_REF: { fromEnv: "X" },
        },
        envRequirements: {},
      });
      expect(result.resolved).toEqual({ GOOD: "value" });
      expect(result.missingVars).toEqual([
        { key: "BAD_REF", type: "fromEnv", fromEnvName: "X" },
      ]);
    });
  });

  // ============================================================
  // Purity / determinism
  // ============================================================
  describe("purity", () => {
    it("calling twice with same inputs returns equal results", () => {
      process.env["X"] = "x-value";
      const args = {
        envConfig: { FOO: "value", BAR: { fromEnv: "X" } },
        envRequirements: { FOO: required(), BAR: required() },
      };
      const r1 = run(args);
      const r2 = run(args);
      expect(r1).toEqual(r2);
    });

    it("does not mutate input envConfig or envRequirements", () => {
      process.env["X"] = "x-value";
      const envConfig = { FOO: "value", BAR: { fromEnv: "X" } as EnvValue };
      const envRequirements = { FOO: required(), BAR: required() };
      const envConfigCopy = JSON.parse(JSON.stringify(envConfig));
      const envRequirementsCopy = JSON.parse(JSON.stringify(envRequirements));
      run({ envConfig, envRequirements });
      expect(envConfig).toEqual(envConfigCopy);
      expect(envRequirements).toEqual(envRequirementsCopy);
    });
  });
});

describe("HeaderTemplatesResolver", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ============================================================
  // No param — plain string passthrough
  // ============================================================
  describe("no param", () => {
    it("string with no {{}} → returned as-is", () => {
      expect(runHeaders({ headers: { AUTH: "Bearer static-token" } })).toEqual({
        AUTH: "Bearer static-token",
      });
    });
  });

  // ============================================================
  // Single param
  // ============================================================
  describe("single param", () => {
    it("param resolves", () => {
      process.env["TOKEN"] = "tok-123";
      expect(runHeaders({ headers: { AUTH: "{{TOKEN}}" } })).toEqual({
        AUTH: "tok-123",
      });
    });

    it("param resolves → interpolated into surrounding string", () => {
      process.env["TOKEN"] = "tok-123";
      expect(runHeaders({ headers: { AUTH: "Bearer {{TOKEN}}" } })).toEqual({
        AUTH: "Bearer tok-123",
      });
    });

    it("param missing → throws PendingInputError", () => {
      delete process.env["TOKEN"];
      expect(() =>
        runHeaders({ headers: { AUTH: "Bearer {{TOKEN}}" } }),
      ).toThrow(PendingInputError);
    });

    it("param missing → missingEnvVars carries the correct entry", () => {
      delete process.env["TOKEN"];
      try {
        runHeaders({ headers: { AUTH: "Bearer {{TOKEN}}" } });
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(PendingInputError);
        expect((e as PendingInputError).missingEnvVars).toEqual([
          { key: "AUTH", type: "fromEnv", fromEnvName: "TOKEN" },
        ]);
      }
    });

    it("param missing, isSpace=true → no throw, header absent from resolved", () => {
      delete process.env["TOKEN"];
      expect(
        runHeaders({ headers: { AUTH: "Bearer {{TOKEN}}" }, isSpace: true }),
      ).toEqual({});
    });

    it("param value is empty string → throws (treated as missing)", () => {
      process.env["TOKEN"] = "";
      expect(() =>
        runHeaders({ headers: { AUTH: "Bearer {{TOKEN}}" } }),
      ).toThrow(PendingInputError);
    });

    it("param value is whitespace-only → throws (treated as missing)", () => {
      process.env["TOKEN"] = "   ";
      expect(() =>
        runHeaders({ headers: { AUTH: "Bearer {{TOKEN}}" } }),
      ).toThrow(PendingInputError);
    });
  });

  // ============================================================
  // Multi params
  // ============================================================
  describe("multi params", () => {
    it("all params resolve → fully expanded", () => {
      process.env["ORG"] = "lunar";
      process.env["KEY"] = "k9x";
      expect(runHeaders({ headers: { AUTH: "{{ORG}}:{{KEY}}" } })).toEqual({
        AUTH: "lunar:k9x",
      });
    });

    it("one param missing → only missing param reported", () => {
      process.env["ORG"] = "lunar";
      delete process.env["KEY"];
      try {
        runHeaders({ headers: { AUTH: "{{ORG}}:{{KEY}}" } });
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(PendingInputError);
        expect((e as PendingInputError).missingEnvVars).toEqual([
          { key: "AUTH", type: "fromEnv", fromEnvName: "KEY" },
        ]);
      }
    });

    it("multiple params missing → all reported in missingEnvVars, not just first", () => {
      delete process.env["ORG"];
      delete process.env["KEY"];
      try {
        runHeaders({ headers: { AUTH: "{{ORG}}:{{KEY}}" } });
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(PendingInputError);
        expect((e as PendingInputError).missingEnvVars).toEqual(
          expect.arrayContaining([
            { key: "AUTH", type: "fromEnv", fromEnvName: "ORG" },
            { key: "AUTH", type: "fromEnv", fromEnvName: "KEY" },
          ]),
        );
      }
    });

    it("same param used twice → both occurrences replaced", () => {
      process.env["X"] = "abc";
      expect(runHeaders({ headers: { H: "{{X}}-{{X}}" } })).toEqual({
        H: "abc-abc",
      });
    });
  });
});
