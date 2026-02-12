import type { ToolCallCacheEntry } from "../model/sessions.js";
import { enforceCacheLimit, pruneExpiredCacheEntries } from "./mcp-gateway.js";

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
