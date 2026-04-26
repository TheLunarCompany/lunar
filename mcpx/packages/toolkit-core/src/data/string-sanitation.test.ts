import { sanitizeFilename } from "./string-sanitation.js";

describe("sanitizeFilename", () => {
  it("replaces invalid characters with underscore", () => {
    expect(sanitizeFilename("my:report*.csv")).toBe("my_report_.csv");
    expect(sanitizeFilename('a/b\\c|d?e"f<g>h')).toBe("a_b_c_d_e_f_g_h");
  });

  it("collapses whitespace and trims ends", () => {
    expect(sanitizeFilename("   hello    world   ")).toBe("hello world");
  });

  it("removes leading dots to avoid hidden files", () => {
    expect(sanitizeFilename(".env")).toBe("env");
    expect(sanitizeFilename("..hidden")).toBe("hidden");
  });

  it("removes trailing dots and spaces", () => {
    expect(sanitizeFilename("report.")).toBe("report");
    expect(sanitizeFilename("name   ")).toBe("name");
    expect(sanitizeFilename("name...   ")).toBe("name");
  });

  it("collapses multiple underscores", () => {
    expect(sanitizeFilename("a::b??c")).toBe("a_b_c");
  });

  it("handles control characters", () => {
    expect(sanitizeFilename("foo\u0000bar")).toBe("foo_bar");
    expect(sanitizeFilename("foo\nbar")).toBe("foo_bar");
  });

  it("normalizes to NFC and keeps unicode", () => {
    // "Cafe\u0301" is 'e' plus combining acute
    expect(sanitizeFilename("Cafe\u0301")).toBe("Café");
    expect(sanitizeFilename("Résumé ✅.md")).toBe("Résumé ✅.md");
  });

  it("guards reserved Windows names", () => {
    expect(sanitizeFilename("CON")).toBe("_CON");
    expect(sanitizeFilename("prn")).toBe("_prn");
    expect(sanitizeFilename("LPT9")).toBe("_LPT9");
    expect(sanitizeFilename("com1")).toBe("_com1");
    // not reserved
    expect(sanitizeFilename("composition")).toBe("composition");
    expect(sanitizeFilename("com0")).toBe("com0");
  });

  it("provides a fallback - `untitled` - for empty results", () => {
    expect(sanitizeFilename("   ")).toBe("untitled");
    expect(sanitizeFilename(".")).toBe("untitled");
    expect(sanitizeFilename("..")).toBe("untitled");
    expect(sanitizeFilename("...   ...")).toBe("untitled");
  });

  it("applies a predictable length limit", () => {
    const long = "a".repeat(300);
    const out = sanitizeFilename(long);
    expect(out.length).toBe(120);
    expect(out).toBe("a".repeat(120));
  });

  // Running multiple times should be stable. Proves that f(f(x)) = f(x)
  it("is idempotent", () => {
    const inputs = [
      " my:report*.csv ",
      "CON",
      "..hidden",
      "Résumé ✅.md",
      "a::b??c",
      "foo\nbar",
    ];
    for (const s of inputs) {
      const once = sanitizeFilename(s); // run once
      const twice = sanitizeFilename(once); // run again on result
      expect(twice).toBe(once); // run again should be same
    }
  });
});
