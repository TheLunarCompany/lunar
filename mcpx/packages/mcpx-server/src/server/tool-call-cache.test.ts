import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import type { ToolCallCacheEntry } from "../model/sessions.js";
import {
  buildToolCallCacheKey,
  enforceCacheLimit,
  pruneExpiredCacheEntries,
} from "./mcp-gateway.js";

function createEntry(
  status: ToolCallCacheEntry["status"],
  expiresAt: number,
): ToolCallCacheEntry {
  switch (status) {
    case "pending":
      return {
        status,
        promise: Promise.resolve({
          content: [],
        }),
        expiresAt,
      };
    case "resolved":
      return {
        status,
        result: { content: [] },
        expiresAt,
      };
    case "rejected":
      return {
        status,
        error: new Error("fail"),
        expiresAt,
      };
  }
}

describe("tool call cache", () => {
  const createRequest = (
    name: string,
    args: Record<string, unknown> | undefined,
    progressToken: string,
  ): CallToolRequest =>
    ({
      method: "tools/call",
      params: {
        name,
        arguments: args,
        _meta: { progressToken },
      },
    }) as CallToolRequest;

  it("cache key includes tool name and arguments in addition to progress token", () => {
    const token = "same-token";
    const key1 = buildToolCallCacheKey(
      createRequest("svc__toolA", { a: 1 }, token),
    );
    const key2 = buildToolCallCacheKey(
      createRequest("svc__toolB", { a: 1 }, token),
    );
    const key3 = buildToolCallCacheKey(
      createRequest("svc__toolA", { a: 2 }, token),
    );

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
  });

  it("cache key is stable for semantically identical arguments", () => {
    const token = "same-token";
    const key1 = buildToolCallCacheKey(
      createRequest("svc__toolA", { a: 1, b: { c: 2 } }, token),
    );
    const key2 = buildToolCallCacheKey(
      createRequest("svc__toolA", { b: { c: 2 }, a: 1 }, token),
    );

    expect(key1).toEqual(key2);
  });

  it("evicts resolved/rejected before pending", () => {
    const now = Date.now();
    const cache = new Map<string, ToolCallCacheEntry>();

    cache.set("pending-1", createEntry("pending", now + 1000));
    cache.set("resolved-1", createEntry("resolved", now + 1000));
    cache.set("rejected-1", createEntry("rejected", now + 1000));
    cache.set("pending-2", createEntry("pending", now + 1000));

    enforceCacheLimit(cache, 2);

    expect([...cache.keys()]).toEqual(["pending-1", "pending-2"]);
  });

  it("evicts oldest pending when only pending entries exist", () => {
    const now = Date.now();
    const cache = new Map<string, ToolCallCacheEntry>();

    cache.set("pending-1", createEntry("pending", now + 1000));
    cache.set("pending-2", createEntry("pending", now + 1000));
    cache.set("pending-3", createEntry("pending", now + 1000));

    enforceCacheLimit(cache, 2);

    expect([...cache.keys()]).toEqual(["pending-2", "pending-3"]);
  });

  it("prunes expired entries", () => {
    const now = Date.now();
    const cache = new Map<string, ToolCallCacheEntry>();

    cache.set("expired", createEntry("resolved", now - 10));
    cache.set("valid", createEntry("resolved", now + 10_000));

    pruneExpiredCacheEntries(cache);

    expect([...cache.keys()]).toEqual(["valid"]);
  });
});
