import { Agent, interceptors, setGlobalDispatcher } from "undici";

type DnsLookup = NonNullable<Parameters<typeof interceptors.dns>[0]>["lookup"];

// Node caches no DNS, so every new connection to an upstream MCP server
// re-resolved its hostname, and under cluster DNS pressure those lookups
// failed (EAI_AGAIN) and took healthy upstreams offline. Installed as the
// global dispatcher, it covers Node's built-in fetch, which the MCP transports
// use. Answers are reused for up to 30s. Both address families are resolved
// and IPv4 is preferred, IPv6 used only for hosts without an IPv4 address:
// without a preference undici alternates families per connection, and on an
// IPv4-only pod every other connection to a dual-stack host would fail.
// The lookup defaults to the system resolver; tests inject their own.
export function installDnsCache(params: { lookup?: DnsLookup } = {}): void {
  const { lookup } = params;
  setGlobalDispatcher(
    new Agent().compose(
      interceptors.dns({ maxTTL: 30_000, affinity: 4, lookup }),
    ),
  );
}
