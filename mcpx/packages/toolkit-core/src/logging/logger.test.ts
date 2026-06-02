import { Writable } from "node:stream";
import { transports } from "winston";
import {
  buildLogger,
  DEFAULT_REDACT_KEYS,
  redactObject,
  redactUrl,
} from "./logger.js";

describe("redactObject", () => {
  it("redacts top-level keys", () => {
    const obj = { env: { SECRET: "abc123" }, name: "test" };
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual({ env: "[REDACTED]", name: "test" });
  });

  it("redacts nested keys", () => {
    const obj = {
      server: {
        name: "my-server",
        env: { API_KEY: "secret" },
      },
    };
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual({
      server: {
        name: "my-server",
        env: "[REDACTED]",
      },
    });
  });

  it("redacts deeply nested keys", () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            env: { PASSWORD: "secret" },
            safe: "value",
          },
        },
      },
    };
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            env: "[REDACTED]",
            safe: "value",
          },
        },
      },
    });
  });

  it("redacts multiple keys", () => {
    const obj = {
      env: { SECRET: "abc" },
      password: "hunter2",
      name: "test",
    };
    const result = redactObject(obj, new Set(["env", "password"]));
    expect(result).toEqual({
      env: "[REDACTED]",
      password: "[REDACTED]",
      name: "test",
    });
  });

  it("does not modify original object", () => {
    const original = { env: { SECRET: "abc" }, name: "test" };
    const originalCopy = JSON.parse(JSON.stringify(original));
    redactObject(original, new Set(["env"]));
    expect(original).toEqual(originalCopy);
  });

  it("returns same structure when no keys to redact", () => {
    const obj = { foo: "bar", nested: { baz: 123 } };
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual(obj);
  });

  it("handles empty object", () => {
    const result = redactObject({}, new Set(["env"]));
    expect(result).toEqual({});
  });

  it("redacts nothing of its own with an empty set (stem net aside)", () => {
    // No sensitive stems here, so an empty set leaves it untouched.
    const obj = { config: { VALUE: "abc" }, name: "test" };
    const result = redactObject(obj, new Set());
    expect(result).toEqual(obj);
  });

  it("recurses into arrays to redact nested keys", () => {
    const obj = {
      items: [{ env: { SECRET: "redact-me" } }, { name: "test" }],
      env: { SECRET: "also-redact" },
    };
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual({
      items: [{ env: "[REDACTED]" }, { name: "test" }],
      env: "[REDACTED]",
    });
  });

  it("redacts array values under redacted keys", () => {
    const obj = {
      env: ["secret1", "secret2", "secret3"],
      name: "test",
    };
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual({
      env: "[REDACTED]",
      name: "test",
    });
  });

  it("preserves primitive values", () => {
    const obj = {
      str: "hello",
      num: 42,
      bool: true,
      nil: null,
      undef: undefined,
    };
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual(obj);
  });

  it("preserves Date objects", () => {
    const date = new Date("2024-01-01");
    const obj = { createdAt: date, env: { SECRET: "abc" } };
    const result = redactObject(obj, new Set(["env"]));
    expect(result["createdAt"]).toBe(date);
    expect(result["env"]).toBe("[REDACTED]");
  });

  it("preserves class instances", () => {
    class MyClass {
      constructor(public value: string) {}
      getValue(): string {
        return this.value;
      }
    }
    const instance = new MyClass("test");
    const obj = { instance, env: { SECRET: "abc" } };
    const result = redactObject(obj, new Set(["env"]));
    expect(result["instance"]).toBe(instance);
    expect((result["instance"] as MyClass).getValue()).toBe("test"); // Casting to MyClass to access method, if this wasn't preserved correctly, this would fail
    expect(result["env"]).toBe("[REDACTED]");
  });

  it("preserves Error objects", () => {
    const error = new Error("something went wrong");
    const obj = { error, env: { SECRET: "abc" } };
    const result = redactObject(obj, new Set(["env"]));
    expect(result["error"]).toBe(error);
    expect(result["env"]).toBe("[REDACTED]");
  });

  it("preserves RegExp objects", () => {
    const regex = /test-pattern/gi;
    const obj = { pattern: regex, env: { SECRET: "abc" } };
    const result = redactObject(obj, new Set(["env"]));
    expect(result["pattern"]).toBe(regex);
    expect(result["env"]).toBe("[REDACTED]");
  });

  it("preserves Map objects (does not recurse)", () => {
    const map = new Map();
    map.set("env", "should-stay");
    const obj = { myMap: map, env: { SECRET: "abc" } };
    const result = redactObject(obj, new Set(["env"]));
    // Map is preserved (not recursed into), but serializes to {} in JSON - no secrets leak
    expect(result["myMap"]).toBe(map);
    expect(JSON.stringify(result["myMap"])).toBe("{}");
    expect(result["env"]).toBe("[REDACTED]");
  });

  it("preserves Set objects (does not recurse)", () => {
    const set = new Set(["env", "other"]);
    const obj = { mySet: set, env: { SECRET: "abc" } };
    const result = redactObject(obj, new Set(["env"]));
    // Set is preserved (not recursed into), but serializes to {} in JSON - no secrets leak
    expect(result["mySet"]).toBe(set);
    expect(JSON.stringify(result["mySet"])).toBe("{}");
    expect(result["env"]).toBe("[REDACTED]");
  });

  it("recurses into arrays containing objects with redacted keys", () => {
    const obj = {
      servers: [
        { name: "server1", env: { API_KEY: "secret1" } },
        { name: "server2", env: { API_KEY: "secret2" } },
      ],
    };
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual({
      servers: [
        { name: "server1", env: "[REDACTED]" },
        { name: "server2", env: "[REDACTED]" },
      ],
    });
  });

  it("matches keys case- and separator-insensitively", () => {
    // The normalized form of "set-cookie" is "setcookie".
    const obj = {
      "set-cookie": "a",
      Set_Cookie: "b",
      setcookie: "c",
      Authorization: "d",
      keep: "e",
    };
    const result = redactObject(obj, new Set(["setcookie", "authorization"]));
    expect(result).toEqual({
      "set-cookie": "[REDACTED]",
      Set_Cookie: "[REDACTED]",
      setcookie: "[REDACTED]",
      Authorization: "[REDACTED]",
      keep: "e",
    });
  });

  it("normalizes caller-supplied keys (raw `api-key` still matches)", () => {
    const obj = { API_KEY: "secret", name: "test" };
    const result = redactObject(obj, new Set(["api-key"]));
    expect(result).toEqual({ API_KEY: "[REDACTED]", name: "test" });
  });

  it("redacts unlisted fields via sensitive stems (safety net)", () => {
    const obj = {
      githubToken: "ghp_123",
      userPassword: "hunter2",
      passwordHash: "abc",
      clientSecret: "shh",
      secretKey: "shh2",
      serviceApiKey: "k-1",
      name: "keep-me",
    };
    const result = redactObject(obj, new Set());
    expect(result).toEqual({
      githubToken: "[REDACTED]",
      userPassword: "[REDACTED]",
      passwordHash: "[REDACTED]",
      clientSecret: "[REDACTED]",
      secretKey: "[REDACTED]",
      serviceApiKey: "[REDACTED]",
      name: "keep-me",
    });
  });

  it("does not redact innocent fields that merely contain a stem", () => {
    const obj = {
      tokenCount: 42,
      promptTokens: 100,
      tokenUsage: { in: 1, out: 2 },
      cacheKey: "abc",
      idempotencyKey: "xyz",
      monkey: "george",
    };
    const result = redactObject(obj, new Set());
    expect(result).toEqual(obj);
  });

  it("handles circular object references without recursing forever", () => {
    const obj: Record<string, unknown> = { name: "root" };
    obj["self"] = obj;
    const result = redactObject(obj, new Set(["env"]));
    expect(result).toEqual({ name: "root", self: "[Circular]" });
  });

  it("handles circular array references", () => {
    const arr: unknown[] = [1];
    arr.push(arr);
    const result = redactObject({ arr }, new Set(["env"]));
    expect(result).toEqual({ arr: [1, "[Circular]"] });
  });

  it("does not flag shared (non-circular) references as circular", () => {
    const shared = { value: 1 };
    const result = redactObject({ a: shared, b: shared }, new Set(["env"]));
    expect(result).toEqual({ a: { value: 1 }, b: { value: 1 } });
  });

  it("truncates structures deeper than the max depth", () => {
    // Build a chain deeper than MAX_REDACT_DEPTH (20).
    let leaf: Record<string, unknown> = { bottom: true };
    for (let i = 0; i < 30; i++) {
      leaf = { next: leaf };
    }
    const result = JSON.stringify(redactObject(leaf, new Set(["env"])));
    expect(result).toContain("[Truncated]");
    expect(result).not.toContain("bottom");
  });

  it("redacts a sensitive key even when its value is circular", () => {
    const secret: Record<string, unknown> = {};
    secret["loop"] = secret;
    const result = redactObject({ token: secret }, new Set(["token"]));
    expect(result).toEqual({ token: "[REDACTED]" });
  });
});

describe("redactUrl", () => {
  it("returns the url unchanged when there is no query string", () => {
    expect(redactUrl("/api/v1/mcpx/owner-123")).toBe("/api/v1/mcpx/owner-123");
  });

  it("leaves a query with no sensitive params unchanged", () => {
    expect(redactUrl("/list?page=2&sort=name")).toBe("/list?page=2&sort=name");
  });

  it("redacts tokens and keys in the query, keeping the rest", () => {
    expect(redactUrl("/cb?access_token=abc123&page=2")).toBe(
      "/cb?access_token=%5BREDACTED%5D&page=2",
    );
  });

  it("redacts the OAuth code param", () => {
    expect(redactUrl("/oauth/callback?code=secret&state=xyz")).toBe(
      "/oauth/callback?code=%5BREDACTED%5D&state=xyz",
    );
  });

  it("matches param names case-insensitively", () => {
    expect(redactUrl("/cb?Access_Token=abc")).toContain("%5BREDACTED%5D");
  });
});

describe("DEFAULT_REDACT_KEYS", () => {
  it("is pre-normalized (lowercased, separators stripped)", () => {
    for (const key of DEFAULT_REDACT_KEYS) {
      expect(key).toBe(key.toLowerCase().replace(/[-_]/g, ""));
    }
    expect(DEFAULT_REDACT_KEYS.has("setcookie")).toBe(true);
    expect(DEFAULT_REDACT_KEYS.has("apikey")).toBe(true);
  });
});

describe("buildLogger redaction (end-to-end)", () => {
  // Route the logger through a Stream transport to exercise the real
  // metadata -> redact -> printf chain end-to-end.
  async function captureOutput(
    log: (logger: ReturnType<typeof buildLogger>) => void,
    redactKeys?: Set<string>,
  ): Promise<string> {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback): void {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const logger = buildLogger({
      logLevel: "silly",
      label: "test",
      redactKeys,
    });
    logger.clear(); // drop the Console transport
    logger.add(new transports.Stream({ stream }));
    log(logger);
    await new Promise((resolve) => setImmediate(resolve));
    return chunks.join("");
  }

  it("redacts default-sensitive keys (incl. nested) without any config", async () => {
    const output = await captureOutput((logger) =>
      logger.info("request done", {
        authorization: "Bearer super-secret-token",
        headers: { cookie: "sid=abc123" },
        nested: { apiKey: "k-do-not-log" },
        safe: "visible",
      }),
    );

    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("super-secret-token");
    expect(output).not.toContain("k-do-not-log");
    expect(output).not.toContain("sid=abc123");
    expect(output).toContain("safe");
    expect(output).toContain("visible");
  });

  it("matches sensitive keys case-insensitively end-to-end", async () => {
    const output = await captureOutput((logger) =>
      logger.info("auth", { Authorization: "Bearer leak-me" }),
    );
    expect(output).not.toContain("leak-me");
    expect(output).toContain("[REDACTED]");
  });

  it("treats caller-supplied redactKeys as additive to the defaults", async () => {
    const output = await captureOutput(
      (logger) =>
        logger.info("custom", {
          customField: "redact-this",
          token: "and-this-default",
        }),
      new Set(["customField"]),
    );
    expect(output).not.toContain("redact-this");
    expect(output).not.toContain("and-this-default");
  });
});
