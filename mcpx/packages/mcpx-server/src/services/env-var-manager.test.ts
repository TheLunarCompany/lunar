import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { EnvVarManager } from "./env-var-manager.js";

describe("EnvVarManager", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("with no snapshot set", () => {
    it("falls back to process.env", () => {
      process.env["FOO"] = "from-process-env";
      const manager = new EnvVarManager(noOpLogger);
      expect(manager.resolve("FOO")).toBe("from-process-env");
    });

    it("returns undefined when neither snapshot nor process.env has the name", () => {
      delete process.env["MISSING"]; // just to be sure
      const manager = new EnvVarManager(noOpLogger);
      expect(manager.resolve("MISSING")).toBeUndefined();
    });
  });

  describe("with snapshot set", () => {
    it("returns snapshot value", () => {
      const manager = new EnvVarManager(noOpLogger);
      manager.setSnapshot({ FOO: "from-snapshot" });
      expect(manager.resolve("FOO")).toBe("from-snapshot");
    });

    it("snapshot wins over process.env on overlap", () => {
      process.env["OVERLAP"] = "from-process-env";
      const manager = new EnvVarManager(noOpLogger);
      manager.setSnapshot({ OVERLAP: "from-snapshot" });
      expect(manager.resolve("OVERLAP")).toBe("from-snapshot");
    });

    it("falls back to process.env for names not in snapshot", () => {
      process.env["FALLBACK"] = "from-process-env";
      const manager = new EnvVarManager(noOpLogger);
      manager.setSnapshot({ OTHER: "snapshot-only" });
      expect(manager.resolve("FALLBACK")).toBe("from-process-env");
    });

    it("returns undefined when name is in neither", () => {
      delete process.env["MISSING"]; // just to be sure
      const manager = new EnvVarManager(noOpLogger);
      manager.setSnapshot({ OTHER: "snapshot-only" });
      expect(manager.resolve("MISSING")).toBeUndefined();
    });
  });

  describe("setSnapshot semantics", () => {
    it("replaces (does not merge) on subsequent calls", () => {
      const manager = new EnvVarManager(noOpLogger);

      // Initially there is nothing
      expect(manager.resolve("FIRST")).toBeUndefined();
      expect(manager.resolve("SECOND")).toBeUndefined();
      expect(manager.resolve("SHARED")).toBeUndefined();

      // Then we set once
      manager.setSnapshot({ FIRST: "first-value", SHARED: "from-first" });
      expect(manager.resolve("FIRST")).toBe("first-value");
      expect(manager.resolve("SECOND")).toBeUndefined();
      expect(manager.resolve("SHARED")).toBe("from-first");

      // And then REPLACE with a new snapshot (does not merge with prior)
      manager.setSnapshot({ SECOND: "second-value", SHARED: "from-second" });
      expect(manager.resolve("FIRST")).toBeUndefined();
      expect(manager.resolve("SECOND")).toBe("second-value");
      expect(manager.resolve("SHARED")).toBe("from-second");
    });

    it("empty snapshot clears prior entries (still falls back to process.env)", () => {
      process.env["FALLBACK"] = "from-process-env";
      const manager = new EnvVarManager(noOpLogger);
      manager.setSnapshot({ FOO: "snapshot" });
      manager.setSnapshot({});

      expect(manager.resolve("FOO")).toBeUndefined();
      expect(manager.resolve("FALLBACK")).toBe("from-process-env");
    });
  });
});
