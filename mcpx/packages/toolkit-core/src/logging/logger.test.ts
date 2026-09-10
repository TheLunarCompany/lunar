import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import { transports } from "winston";
import {
  accessLogFor,
  buildLogger,
  DEFAULT_REDACT_KEYS,
  LogFormat,
  redactObject,
  redactUrl,
} from "./logger.js";
import { runWithRequestId } from "./request-context.js";

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

// Route the logger through a Stream transport to exercise the real
// metadata -> redact -> format chain end-to-end.
async function captureOutput(
  log: (logger: ReturnType<typeof buildLogger>) => void,
  opts: { redactKeys?: Set<string>; format?: LogFormat } = {},
): Promise<string> {
  const { redactKeys, format } = opts;
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
    format,
  });
  logger.clear(); // drop the Console transport
  logger.add(new transports.Stream({ stream }));
  log(logger);
  await new Promise((resolve) => setImmediate(resolve));
  return chunks.join("");
}

describe("buildLogger redaction (end-to-end)", () => {
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
      { redactKeys: new Set(["customField"]) },
    );
    expect(output).not.toContain("redact-this");
    expect(output).not.toContain("and-this-default");
  });
});

describe("buildLogger output format", () => {
  it("defaults to the pretty printf format", async () => {
    const output = await captureOutput((logger) =>
      logger.info("User login", { userId: "u-42" }),
    );
    expect(output).toContain('INFO: User login userId="u-42"');
    expect(() => JSON.parse(output)).toThrow();
  });

  it("emits structured JSON lines when format is json", async () => {
    const output = await captureOutput(
      (logger) =>
        logger.info("User login", { userId: "u-42", method: "oauth" }),
      { format: "json" },
    );
    const parsed = JSON.parse(output);
    expect(parsed).toMatchObject({
      level: "info",
      message: "User login",
      label: "test",
      metadata: { userId: "u-42", method: "oauth" },
    });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("still redacts sensitive metadata in json format", async () => {
    const output = await captureOutput(
      (logger) => logger.info("auth", { authorization: "Bearer leak-me" }),
      { format: "json" },
    );
    expect(output).not.toContain("leak-me");
    const parsed = JSON.parse(output);
    expect(parsed.metadata.authorization).toBe("[REDACTED]");
  });
});

describe("accessLogFor", () => {
  interface FakeResponse extends EventEmitter {
    statusCode: number;
    headers: Record<string, string>;
    setHeader: (name: string, value: string) => void;
  }

  function buildFakeResponse(): FakeResponse {
    const headers: Record<string, string> = {};
    return Object.assign(new EventEmitter(), {
      statusCode: 200,
      headers,
      setHeader: (name: string, value: string): void => {
        headers[name] = value;
      },
    });
  }

  async function captureAccessLog(params: {
    requestHeaders: Record<string, string>;
  }): Promise<{ parsed: Record<string, unknown>; res: FakeResponse }> {
    const { requestHeaders } = params;
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
      format: "json",
    });
    logger.clear();
    logger.add(new transports.Stream({ stream }));

    const middleware = accessLogFor(logger);
    const req = {
      method: "GET",
      originalUrl: "/api/v1/thing?page=2",
      headers: requestHeaders,
    };
    const res = buildFakeResponse();
    // Handcrafted stubs cover the express surface accessLogFor touches.
    middleware(req as never, res as never, () => {});
    res.emit("finish");
    await new Promise((resolve) => setImmediate(resolve));
    return { parsed: JSON.parse(chunks.join("")), res };
  }

  it("logs structured request fields and generates a request id", async () => {
    const { parsed, res } = await captureAccessLog({ requestHeaders: {} });
    expect(parsed["metadata"]).toMatchObject({
      method: "GET",
      requestUri: "/api/v1/thing?page=2",
      responseCode: 200,
    });
    const metadata = parsed["metadata"] as Record<string, unknown>;
    expect(typeof metadata["duration"]).toBe("number");
    expect(typeof metadata["requestId"]).toBe("string");
    expect(res.headers["x-request-id"]).toBe(metadata["requestId"]);
  });

  it("propagates an incoming x-request-id header", async () => {
    const { parsed, res } = await captureAccessLog({
      requestHeaders: { "x-request-id": "req-abc" },
    });
    const metadata = parsed["metadata"] as Record<string, unknown>;
    expect(metadata["requestId"]).toBe("req-abc");
    expect(res.headers["x-request-id"]).toBe("req-abc");
  });

  it("threads the request id through ignored routes without an access-log line", async () => {
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
      format: "json",
    });
    logger.clear();
    logger.add(new transports.Stream({ stream }));

    const middleware = accessLogFor(logger, [{ method: "POST", path: "/mcp" }]);
    const req = {
      method: "POST",
      originalUrl: "/mcp",
      headers: { "x-request-id": "req-ignored" },
    };
    const res = buildFakeResponse();
    middleware(req as never, res as never, () => {
      logger.info("inside ignored route");
    });
    res.emit("finish");
    await new Promise((resolve) => setImmediate(resolve));

    const lines = chunks.join("").trim().split("\n");
    expect(lines).toHaveLength(1); // no access-log line, just the route's own
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed.message).toBe("inside ignored route");
    expect(parsed.metadata.requestId).toBe("req-ignored");
    expect(res.headers["x-request-id"]).toBe("req-ignored");
  });

  it("threads the request id to logs emitted downstream of the middleware", async () => {
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
      format: "json",
    });
    logger.clear();
    logger.add(new transports.Stream({ stream }));

    const middleware = accessLogFor(logger);
    const req = {
      method: "GET",
      originalUrl: "/thing",
      headers: { "x-request-id": "req-threaded" },
    };
    const downstream = new Promise<void>((resolve) => {
      middleware(req as never, buildFakeResponse() as never, () => {
        // Simulates a route handler: async hop, then a plain logger call.
        setImmediate(() => {
          logger.info("deep in the request");
          resolve();
        });
      });
    });
    await downstream;
    await new Promise((resolve) => setImmediate(resolve));

    const parsed = JSON.parse(chunks.join(""));
    expect(parsed.message).toBe("deep in the request");
    expect(parsed.metadata.requestId).toBe("req-threaded");
  });
});

describe("request context (ambient requestId)", () => {
  it("stamps the ambient request id on log lines inside the context", async () => {
    const output = await captureOutput(
      (logger) => runWithRequestId("req-ctx-1", () => logger.info("inside")),
      { format: "json" },
    );
    const parsed = JSON.parse(output);
    expect(parsed.metadata.requestId).toBe("req-ctx-1");
  });

  it("lets an explicitly passed requestId win over the ambient one", async () => {
    const output = await captureOutput(
      (logger) =>
        runWithRequestId("ambient", () =>
          logger.info("explicit", { requestId: "explicit-wins" }),
        ),
      { format: "json" },
    );
    const parsed = JSON.parse(output);
    expect(parsed.metadata.requestId).toBe("explicit-wins");
  });

  it("adds no requestId outside a request context", async () => {
    const output = await captureOutput((logger) => logger.info("no context"), {
      format: "json",
    });
    const parsed = JSON.parse(output);
    expect(parsed.metadata.requestId).toBeUndefined();
  });
});
