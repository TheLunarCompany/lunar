// Resolves an incoming request's host to a provider key in the
// static-OAuth `mapping` table.
//
// Rules:
//   - Exact host wins over any wildcard.
//   - `*.foo.com` matches `foo.com` (apex) and any subdomain at any
//     depth (`bar.foo.com`, `bar.baz.foo.com`).
//   - `*.foo.com` does NOT match `foo.bar.com` or `myfoo.com`.
//   - Among matching wildcards, the longest suffix wins
//     (`*.api.foo.com` beats `*.foo.com` for `auth.api.foo.com`).
//
// Inputs are normalized (lowercase, trailing dot stripped) before
// matching, so the matcher works correctly regardless of how the
// caller supplied the host or how the admin typed mapping keys.
const WILDCARD_PREFIX = "*.";

export function resolveProviderKey(
  host: string,
  mapping: Record<string, string>,
): string | undefined {
  const normHost = normalizeHost(host);

  let bestSuffix: string | undefined;
  let bestKey: string | undefined;

  // Mapping is host-pattern → provider key. Walk it to find the best match for normHost.
  for (const [rawPattern, key] of Object.entries(mapping)) {
    const pattern = normalizeHost(rawPattern);

    if (pattern === normHost) return key;

    // Non-wildcard entries that didn't match exactly above don't apply to this host.
    if (!pattern.startsWith(WILDCARD_PREFIX)) continue;
    const suffix = pattern.slice(WILDCARD_PREFIX.length);
    // Wildcard matches the apex (host equals suffix) or any subdomain (host ends with ".suffix").
    if (normHost !== suffix && !normHost.endsWith("." + suffix)) continue;
    // More-specific wildcards (longer suffix) override less-specific ones.
    if (bestSuffix === undefined || suffix.length > bestSuffix.length) {
      bestSuffix = suffix;
      bestKey = key;
    }
  }

  return bestKey;
}

function normalizeHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.endsWith(".") ? lower.slice(0, -1) : lower;
}
