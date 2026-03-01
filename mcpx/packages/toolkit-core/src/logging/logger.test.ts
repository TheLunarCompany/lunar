import { redactObject } from "./logger.js";

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

  it("handles empty redact keys set", () => {
    const obj = { env: { SECRET: "abc" }, name: "test" };
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
});
