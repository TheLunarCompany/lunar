import { describe, it, expect } from "@jest/globals";
import { hashObject, hashStableObject, stableStringify } from "./hashing.js";

describe("hashObject", () => {
  describe("primitive types", () => {
    it("should produce same hash for same primitives", () => {
      expect(hashObject(42)).toBe(hashObject(42));
      expect(hashObject("hello")).toBe(hashObject("hello"));
      expect(hashObject(true)).toBe(hashObject(true));
      expect(hashObject(null)).toBe(hashObject(null));

      // Note: hashObject(undefined) is not supported as top-level value
      // because JSON.stringify(undefined) returns undefined (not a string)
      // However, undefined values *inside* objects/arrays work fine
    });

    it("should produce different hashes for different primitives", () => {
      expect(hashObject(42)).not.toBe(hashObject(43));
      expect(hashObject("hello")).not.toBe(hashObject("world"));
      expect(hashObject(true)).not.toBe(hashObject(false));
    });
  });

  describe("object key order independence", () => {
    it("should produce same hash for objects with same content but different key order", () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const obj3 = { b: 2, c: 3, a: 1 };

      const hash1 = hashObject(obj1);
      const hash2 = hashObject(obj2);
      const hash3 = hashObject(obj3);

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });

    it("should produce same hash for nested objects with different key order", () => {
      const obj1 = {
        outer: { a: 1, b: 2 },
        inner: { x: 10, y: 20 },
      };
      const obj2 = {
        inner: { y: 20, x: 10 },
        outer: { b: 2, a: 1 },
      };

      expect(hashObject(obj1)).toBe(hashObject(obj2));
    });

    it("should produce different hash when object content differs", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };

      expect(hashObject(obj1)).not.toBe(hashObject(obj2));
    });
  });

  describe("array order independence", () => {
    it("should produce same hash for arrays with same elements in different order", () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 1, 2];
      const arr3 = [2, 3, 1];

      const hash1 = hashObject(arr1);
      const hash2 = hashObject(arr2);
      const hash3 = hashObject(arr3);

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });

    it("should produce same hash for arrays of objects in different order", () => {
      const arr1 = [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
      ];
      const arr2 = [
        { id: 2, name: "b" },
        { id: 1, name: "a" },
      ];

      expect(hashObject(arr1)).toBe(hashObject(arr2));
    });

    it("should produce different hash when array content differs", () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 4];

      expect(hashObject(arr1)).not.toBe(hashObject(arr2));
    });
  });

  describe("complex nested structures", () => {
    it("should handle deeply nested objects with mixed key/array order", () => {
      const obj1 = {
        users: [
          { id: 1, tags: ["admin", "user"] },
          { id: 2, tags: ["guest", "viewer"] },
        ],
        settings: {
          theme: "dark",
          notifications: { email: true, push: false },
        },
      };

      const obj2 = {
        settings: {
          notifications: { push: false, email: true },
          theme: "dark",
        },
        users: [
          { tags: ["viewer", "guest"], id: 2 },
          { tags: ["user", "admin"], id: 1 },
        ],
      };

      expect(hashObject(obj1)).toBe(hashObject(obj2));
    });

    it("should differentiate between similar nested structures with different values", () => {
      const obj1 = {
        users: [{ id: 1, name: "Alice" }],
        count: 1,
      };

      const obj2 = {
        users: [{ id: 1, name: "Bob" }],
        count: 1,
      };

      expect(hashObject(obj1)).not.toBe(hashObject(obj2));
    });
  });

  describe("objects with Record/Map-like structures", () => {
    it("should handle tool-like objects with different key order", () => {
      const tools1 = {
        "read-file": {
          description: "Read a file",
          isCustom: false,
          usage: { callCount: 5 },
        },
        "write-file": {
          description: "Write a file",
          isCustom: false,
          usage: { callCount: 3 },
        },
      };

      const tools2 = {
        "write-file": {
          usage: { callCount: 3 },
          isCustom: false,
          description: "Write a file",
        },
        "read-file": {
          usage: { callCount: 5 },
          description: "Read a file",
          isCustom: false,
        },
      };

      expect(hashObject(tools1)).toBe(hashObject(tools2));
    });

    it("should detect changes in nested record values", () => {
      const tools1 = {
        "read-file": { usage: { callCount: 5 } },
      };

      const tools2 = {
        "read-file": { usage: { callCount: 6 } },
      };

      expect(hashObject(tools1)).not.toBe(hashObject(tools2));
    });
  });

  describe("edge cases", () => {
    it("should handle empty objects and arrays", () => {
      expect(hashObject({})).toBe(hashObject({}));
      expect(hashObject([])).toBe(hashObject([]));

      // **IMPORTANT: Empty objects and arrays produce the SAME hash**
      // This is because both normalize to an empty sorted array []
      // This is acceptable for our use case (usage stats deduplication)
      expect(hashObject({})).toBe(hashObject([]));
    });

    it("should handle objects with null and undefined values", () => {
      const obj1 = { a: null, b: undefined };
      const obj2 = { b: undefined, a: null };

      // **IMPORTANT: undefined becomes null in JSON.stringify**
      // So { a: null, b: undefined } hashes the same as { a: null, b: null }
      // This is acceptable for our use case (usage stats deduplication)
      expect(hashObject(obj1)).toBe(hashObject(obj2));
    });

    it("should handle arrays with null and undefined", () => {
      const arr1 = [null, undefined, 1];
      const arr2 = [1, null, undefined];

      // **IMPORTANT: undefined becomes null in JSON.stringify**
      // So [null, undefined, 1] is treated as [null, null, 1]
      expect(hashObject(arr1)).toBe(hashObject(arr2));
    });

    it("should differentiate between 0 and empty string", () => {
      expect(hashObject({ val: 0 })).not.toBe(hashObject({ val: "" }));
      expect(hashObject({ val: 0 })).not.toBe(hashObject({ val: false }));
    });

    it("should handle arrays with duplicate elements", () => {
      const arr1 = [1, 2, 2, 3];
      const arr2 = [3, 2, 1, 2];

      expect(hashObject(arr1)).toBe(hashObject(arr2));
    });
  });

  describe("realistic usage stats scenarios", () => {
    it("should dedupe when targetServers are in different order", () => {
      const stats1 = {
        agents: [],
        targetServers: [
          { name: "server1", status: "connected", tools: {} },
          { name: "server2", status: "connected", tools: {} },
        ],
      };

      const stats2 = {
        agents: [],
        targetServers: [
          { name: "server2", status: "connected", tools: {} },
          { name: "server1", status: "connected", tools: {} },
        ],
      };

      expect(hashObject(stats1)).toBe(hashObject(stats2));
    });

    it("should detect when tool callCount changes", () => {
      const stats1 = {
        targetServers: [
          {
            name: "server1",
            tools: { "read-file": { usage: { callCount: 5 } } },
          },
        ],
      };

      const stats2 = {
        targetServers: [
          {
            name: "server1",
            tools: { "read-file": { usage: { callCount: 6 } } },
          },
        ],
      };

      expect(hashObject(stats1)).not.toBe(hashObject(stats2));
    });

    it("should dedupe when tools are in different key order", () => {
      const stats1 = {
        targetServers: [
          {
            name: "server1",
            tools: {
              "read-file": { usage: { callCount: 1 } },
              "write-file": { usage: { callCount: 2 } },
            },
          },
        ],
      };

      const stats2 = {
        targetServers: [
          {
            name: "server1",
            tools: {
              "write-file": { usage: { callCount: 2 } },
              "read-file": { usage: { callCount: 1 } },
            },
          },
        ],
      };

      expect(hashObject(stats1)).toBe(hashObject(stats2));
    });
  });

  describe("hash consistency", () => {
    it("should produce deterministic 64-character hex strings", () => {
      const hash = hashObject({ a: 1, b: 2 });

      expect(typeof hash).toBe("string");
      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce same hash across multiple calls", () => {
      const obj = { complex: { nested: [1, 2, { deep: true }] } };

      const hash1 = hashObject(obj);
      const hash2 = hashObject(obj);
      const hash3 = hashObject(obj);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });
});

describe("hashStableObject", () => {
  it("ignores object key order", () => {
    const one = { b: 2, a: 1 };
    const two = { a: 1, b: 2 };
    expect(hashStableObject(one)).toBe(hashStableObject(two));
  });

  it("preserves array order", () => {
    const one = { list: [1, 2, 3] };
    const two = { list: [3, 2, 1] };
    expect(hashStableObject(one)).not.toBe(hashStableObject(two));
  });
});

describe("stableStringify", () => {
  it("sorts object keys deterministically", () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("normalizes undefined to null", () => {
    expect(stableStringify({ value: undefined })).toBe('{"value":null}');
  });
});
