import { afterEach, describe, expect, it } from "@jest/globals";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { fetch, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { installDnsCache } from "./dns-cache.js";

// An upstream that closes every connection, so each fetch opens a new one and
// would need a fresh lookup without the cache.
async function startClosingUpstream(): Promise<{
  server: http.Server;
  port: number;
}> {
  const server = http.createServer((_req, res) => {
    res.setHeader("Connection", "close");
    res.end("ok");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, port };
}

describe("installDnsCache", () => {
  const previousDispatcher = getGlobalDispatcher();
  const cleanups: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    setGlobalDispatcher(previousDispatcher);
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  // The host only exists in the injected resolver, so the calls succeeding at
  // all proves they went through the installed global dispatcher. undici's own
  // fetch stands in for Node's: Jest's per-file globalThis hides the dispatcher
  // from the built-in one, which in the gateway reads the same global.
  it("resolves a host once across fresh connections through the global dispatcher", async () => {
    const upstream = await startClosingUpstream();
    cleanups.push(
      () =>
        new Promise<void>((resolve) => upstream.server.close(() => resolve())),
    );
    const lookups: string[] = [];
    installDnsCache({
      lookup: (origin, _options, callback) => {
        lookups.push(origin.hostname);
        callback(null, [{ address: "127.0.0.1", family: 4, ttl: 30_000 }]);
      },
    });

    const bodies = [];
    for (let i = 0; i < 5; i += 1) {
      const response = await fetch(
        `http://mcpx-upstream.test:${upstream.port}/`,
      );
      bodies.push(await response.text());
    }

    expect(bodies).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(lookups).toEqual(["mcpx-upstream.test"]);
  });
  // 100::1 is in the IPv6 discard prefix: a connection to it never succeeds.
  it("prefers IPv4 for a host that also has an IPv6 address", async () => {
    const upstream = await startClosingUpstream();
    cleanups.push(
      () =>
        new Promise<void>((resolve) => upstream.server.close(() => resolve())),
    );
    installDnsCache({
      lookup: (_origin, _options, callback) => {
        callback(null, [
          { address: "127.0.0.1", family: 4, ttl: 30_000 },
          { address: "100::1", family: 6, ttl: 30_000 },
        ]);
      },
    });

    const bodies = [];
    for (let i = 0; i < 4; i += 1) {
      const response = await fetch(
        `http://mcpx-upstream.test:${upstream.port}/`,
      );
      bodies.push(await response.text());
    }

    expect(bodies).toEqual(["ok", "ok", "ok", "ok"]);
  });
});
