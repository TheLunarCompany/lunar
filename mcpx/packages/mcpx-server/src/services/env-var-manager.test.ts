import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { EnvVarManager } from "./env-var-manager.js";

// Per-test factory: each call returns a fresh manager plus closure-scoped
// apply helpers that auto-bump a local timestamp counter. No shared state
// across tests.
function setupManager(): {
  manager: EnvVarManager;
  applyProfile: (
    entries: Record<string, string>,
    timestamp?: number,
  ) => boolean;
  applyOauth: (entries: Record<string, string>, timestamp?: number) => boolean;
} {
  const manager = new EnvVarManager(noOpLogger);
  let nextTs = 1;
  return {
    manager,
    applyProfile: (entries, timestamp) =>
      manager.applyProfileSecrets({
        entries,
        timestamp: timestamp ?? nextTs++,
      }),
    applyOauth: (entries, timestamp) =>
      manager.applyOauthCredentials({
        entries,
        timestamp: timestamp ?? nextTs++,
      }),
  };
}

describe("EnvVarManager", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("resolveTargetServerEnv", () => {
    it("returns the profileSecrets entry", () => {
      const { manager, applyProfile } = setupManager();
      applyProfile({ FOO: "from-snapshot" });
      expect(manager.resolveTargetServerEnv("FOO")).toBe("from-snapshot");
    });

    it("profileSecrets wins over process.env on overlap", () => {
      process.env["OVERLAP"] = "from-process-env";
      const { manager, applyProfile } = setupManager();
      applyProfile({ OVERLAP: "from-snapshot" });
      expect(manager.resolveTargetServerEnv("OVERLAP")).toBe("from-snapshot");
    });

    it("falls back to process.env for names not in profileSecrets", () => {
      process.env["FALLBACK"] = "from-process-env";
      const { manager, applyProfile } = setupManager();
      applyProfile({ OTHER: "snapshot-only" });
      expect(manager.resolveTargetServerEnv("FALLBACK")).toBe(
        "from-process-env",
      );
    });

    it("does NOT read from oauthCredentials (scope isolation)", () => {
      const { manager, applyOauth } = setupManager();
      applyOauth({ OAUTH_KEY: "oauth-val" });
      expect(manager.resolveTargetServerEnv("OAUTH_KEY")).toBeUndefined();
    });

    it("returns undefined when name is in neither map nor process.env", () => {
      delete process.env["MISSING"];
      const { manager } = setupManager();
      expect(manager.resolveTargetServerEnv("MISSING")).toBeUndefined();
    });
  });

  describe("resolveOauthCredential", () => {
    it("returns the oauthCredentials entry", () => {
      const { manager, applyOauth } = setupManager();
      applyOauth({ FOO: "from-oauth" });
      expect(manager.resolveOauthCredential("FOO")).toBe("from-oauth");
    });

    it("oauthCredentials wins over process.env on overlap", () => {
      process.env["OVERLAP"] = "from-process-env";
      const { manager, applyOauth } = setupManager();
      applyOauth({ OVERLAP: "from-oauth" });
      expect(manager.resolveOauthCredential("OVERLAP")).toBe("from-oauth");
    });

    it("falls back to process.env for names not in oauthCredentials", () => {
      process.env["FALLBACK"] = "from-process-env";
      const { manager, applyOauth } = setupManager();
      applyOauth({ OTHER: "oauth-only" });
      expect(manager.resolveOauthCredential("FALLBACK")).toBe(
        "from-process-env",
      );
    });

    it("does NOT read from profileSecrets (scope isolation)", () => {
      const { manager, applyProfile } = setupManager();
      applyProfile({ PROFILE_KEY: "profile-val" });
      expect(manager.resolveOauthCredential("PROFILE_KEY")).toBeUndefined();
    });
  });

  describe("applyProfileSecrets", () => {
    it("replaces (does not merge) on subsequent applies", () => {
      const { manager, applyProfile } = setupManager();
      applyProfile({ FIRST: "first-value", SHARED: "from-first" });
      applyProfile({ SECOND: "second-value", SHARED: "from-second" });

      expect(manager.resolveTargetServerEnv("FIRST")).toBeUndefined();
      expect(manager.resolveTargetServerEnv("SECOND")).toBe("second-value");
      expect(manager.resolveTargetServerEnv("SHARED")).toBe("from-second");
    });

    it("drops a snapshot whose timestamp is older than the last applied", () => {
      const { manager, applyProfile } = setupManager();
      const appliedAt10 = applyProfile({ K: "at-10" }, 10);
      const appliedAt5 = applyProfile({ K: "at-5" }, 5);

      expect(appliedAt10).toBe(true);
      expect(appliedAt5).toBe(false);
      expect(manager.resolveTargetServerEnv("K")).toBe("at-10");
    });

    it("applies on tie (last-write-wins)", () => {
      const { manager, applyProfile } = setupManager();
      applyProfile({ K: "first" }, 10);
      const applied = applyProfile({ K: "second" }, 10);

      expect(applied).toBe(true);
      expect(manager.resolveTargetServerEnv("K")).toBe("second");
    });

    it("applies any timestamp on the first snapshot", () => {
      const { manager, applyProfile } = setupManager();
      const applied = applyProfile({ K: "v" }, 0);
      expect(applied).toBe(true);
      expect(manager.resolveTargetServerEnv("K")).toBe("v");
    });
  });

  describe("applyOauthCredentials", () => {
    it("replaces (does not merge) on subsequent applies", () => {
      const { manager, applyOauth } = setupManager();
      applyOauth({ A: "1" });
      applyOauth({ B: "2" });

      expect(manager.resolveOauthCredential("A")).toBeUndefined();
      expect(manager.resolveOauthCredential("B")).toBe("2");
    });

    it("drops a snapshot whose timestamp is older than the last applied", () => {
      const { manager, applyOauth } = setupManager();
      const at10 = applyOauth({ K: "at-10" }, 10);
      const at5 = applyOauth({ K: "at-5" }, 5);

      expect(at10).toBe(true);
      expect(at5).toBe(false);
      expect(manager.resolveOauthCredential("K")).toBe("at-10");
    });

    it("applies on tie (last-write-wins)", () => {
      const { manager, applyOauth } = setupManager();
      applyOauth({ K: "first" }, 10);
      const applied = applyOauth({ K: "second" }, 10);

      expect(applied).toBe(true);
      expect(manager.resolveOauthCredential("K")).toBe("second");
    });
  });

  describe("per-bucket timestamp isolation", () => {
    it("a stale profile snapshot does not affect oauth bucket's lastApplied", () => {
      const { manager, applyProfile, applyOauth } = setupManager();
      applyProfile({ P: "p-at-10" }, 10);
      applyOauth({ O: "o-at-5" }, 5);

      // Each bucket tracks its own timeline; oauth at t=5 is the first oauth snapshot
      // so it applies even though profile's lastApplied is 10.
      expect(manager.resolveOauthCredential("O")).toBe("o-at-5");
      expect(manager.resolveTargetServerEnv("P")).toBe("p-at-10");
    });

    it("the two buckets do not interfere when applied independently", () => {
      const { manager, applyProfile, applyOauth } = setupManager();
      applyProfile({ P: "p-val" });
      applyOauth({ O: "o-val" });

      expect(manager.resolveTargetServerEnv("P")).toBe("p-val");
      expect(manager.resolveOauthCredential("O")).toBe("o-val");
      expect(manager.resolveTargetServerEnv("O")).toBeUndefined();
      expect(manager.resolveOauthCredential("P")).toBeUndefined();
    });
  });

  describe("getProfileSecrets / getProfileSecretKeys", () => {
    it("returns profileSecrets as a Record (no oauthCredentials, no process.env)", () => {
      process.env["FROM_ENV"] = "leaked";
      const { manager, applyProfile, applyOauth } = setupManager();
      applyProfile({ A: "1", B: "2" });
      applyOauth({ O: "o-val" });

      expect(manager.getTargetServerEnv()).toEqual({ A: "1", B: "2" });
      expect(manager.getProfileSecretKeys().sort()).toEqual(["A", "B"]);
    });

    it("returns empty when no profileSecrets have been set", () => {
      const { manager } = setupManager();
      expect(manager.getTargetServerEnv()).toEqual({});
      expect(manager.getProfileSecretKeys()).toEqual([]);
    });
  });
});
