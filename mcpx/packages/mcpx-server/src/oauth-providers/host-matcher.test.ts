import { resolveProviderKey } from "./host-matcher.js";

describe("resolveProviderKey", () => {
  describe("exact match", () => {
    it("returns the provider key for an exact host", () => {
      expect(resolveProviderKey("foo.com", { "foo.com": "P" })).toBe("P");
    });

    it("returns undefined when no entry matches", () => {
      expect(resolveProviderKey("foo.com", { "bar.com": "P" })).toBeUndefined();
    });

    it("returns undefined for an empty mapping", () => {
      expect(resolveProviderKey("foo.com", {})).toBeUndefined();
    });

    it("wins over a wildcard that would otherwise match", () => {
      expect(
        resolveProviderKey("foo.com", {
          "foo.com": "P-exact",
          "*.foo.com": "P-wild",
        }),
      ).toBe("P-exact");
    });
  });

  describe("wildcard match", () => {
    it("matches the apex (`*.foo.com` matches `foo.com`)", () => {
      expect(resolveProviderKey("foo.com", { "*.foo.com": "P" })).toBe("P");
    });

    it("matches a single-label subdomain", () => {
      expect(resolveProviderKey("api.foo.com", { "*.foo.com": "P" })).toBe("P");
    });

    it("matches a deep subdomain (any depth)", () => {
      expect(resolveProviderKey("auth.api.foo.com", { "*.foo.com": "P" })).toBe(
        "P",
      );
    });

    it("does not match an unrelated suffix (`foo.bar.com` vs `*.foo.com`)", () => {
      expect(
        resolveProviderKey("foo.bar.com", { "*.foo.com": "P" }),
      ).toBeUndefined();
    });

    it("does not match a string-prefixed lookalike (`myfoo.com` vs `*.foo.com`)", () => {
      expect(
        resolveProviderKey("myfoo.com", { "*.foo.com": "P" }),
      ).toBeUndefined();
    });

    it("most specific wildcard wins (longest suffix)", () => {
      expect(
        resolveProviderKey("auth.api.foo.com", {
          "*.foo.com": "P-broad",
          "*.api.foo.com": "P-specific",
        }),
      ).toBe("P-specific");
    });

    it("falls back to a broader wildcard when the specific one doesn't match", () => {
      expect(
        resolveProviderKey("auth.foo.com", {
          "*.foo.com": "P-broad",
          "*.api.foo.com": "P-specific",
        }),
      ).toBe("P-broad");
    });
  });

  describe("malformed or pathological patterns", () => {
    it("a double-wildcard pattern (`*.*.foo.com`) matches nothing — only the leading `*.` is recognized", () => {
      expect(
        resolveProviderKey("bar.foo.com", { "*.*.foo.com": "P" }),
      ).toBeUndefined();
      expect(
        resolveProviderKey("foo.com", { "*.*.foo.com": "P" }),
      ).toBeUndefined();
    });

    it("does not confuse different TLDs with overlapping prefixes (`*.bla.co.uk` does not match `foo.bla.co`)", () => {
      expect(
        resolveProviderKey("foo.bla.co", { "*.bla.co.uk": "P" }),
      ).toBeUndefined();
    });
  });

  describe("normalization", () => {
    it("matches case-insensitively in both host and pattern", () => {
      expect(resolveProviderKey("API.FOO.com", { "*.Foo.COM": "P" })).toBe("P");
    });

    it("ignores a trailing dot on the host", () => {
      expect(resolveProviderKey("foo.com.", { "foo.com": "P" })).toBe("P");
    });
  });
});
