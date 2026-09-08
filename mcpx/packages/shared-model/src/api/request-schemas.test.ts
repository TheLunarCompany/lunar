import {
  envRequirementSchema,
  HEADER_PARAMS_EXTRACTION_REGEX,
  isValidHeaderTemplateString,
} from "./request-schemas.js";

function extractParams(value: string): string[] {
  return [...value.matchAll(HEADER_PARAMS_EXTRACTION_REGEX)].map(
    (m) => m[1] ?? "",
  );
}

describe("HEADER_PARAMS_EXTRACTION_REGEX", () => {
  it("no params → empty array", () => {
    expect(extractParams("Bearer abc")).toEqual([]);
  });

  it("single param → one match", () => {
    expect(extractParams("Bearer {{TOKEN}}")).toEqual(["TOKEN"]);
  });

  it("multiple params → all extracted in order", () => {
    expect(extractParams("Bearer {{ORG}} scopes {{KEY}}")).toEqual([
      "ORG",
      "KEY",
    ]);
  });

  it("same param repeated → extracted twice, no deduplication", () => {
    expect(extractParams("Bearer {{X}}-{{X}}")).toEqual(["X", "X"]);
  });
});

describe("isValidHeaderTemplateString", () => {
  it("empty string → valid", () => {
    expect(isValidHeaderTemplateString("")).toBe(true);
  });

  it("plain string with no braces → valid", () => {
    expect(isValidHeaderTemplateString("Bearer abc")).toBe(true);
  });

  it("single template param → valid", () => {
    expect(isValidHeaderTemplateString("Bearer {{TOKEN}}")).toBe(true);
  });

  it("multiple params with string between → valid", () => {
    expect(isValidHeaderTemplateString("Bearer {{ORG}}:{{KEY}}")).toBe(true);
  });

  it("multiple params adjacent, no separator → valid", () => {
    expect(isValidHeaderTemplateString("{{ORG}}{{KEY}}")).toBe(true);
  });

  it("unmatched multiple } → invalid", () => {
    expect(isValidHeaderTemplateString("bad {{value}")).toBe(false);
    expect(isValidHeaderTemplateString("bad {value}}")).toBe(false);
  });

  it("empty {{}} → invalid", () => {
    expect(isValidHeaderTemplateString("Bearer {{}}")).toBe(false);
  });
});

// We normalize empty prefilled (drop for required/optional, reject for fixed) instead of using
// `.min(1)` so existing DB rows with `prefilled: ""` keep parsing — a strict reject would break them.
describe("envRequirementSchema — empty prefilled handling", () => {
  describe("required kind", () => {
    it("drops empty string prefilled → no prefill", () => {
      const result = envRequirementSchema.safeParse({
        kind: "required",
        prefilled: "",
        isSecret: true,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ kind: "required", isSecret: true });
      expect(result.data?.prefilled).toBeUndefined();
    });

    it("drops { fromEnv: '' } prefilled → no prefill", () => {
      const result = envRequirementSchema.safeParse({
        kind: "required",
        prefilled: { fromEnv: "" },
      });
      expect(result.success).toBe(true);
      expect(result.data?.prefilled).toBeUndefined();
    });

    it("drops { fromSecret: '' } prefilled → no prefill", () => {
      const result = envRequirementSchema.safeParse({
        kind: "required",
        prefilled: { fromSecret: "" },
      });
      expect(result.success).toBe(true);
      expect(result.data?.prefilled).toBeUndefined();
    });

    it("drops null prefilled → no prefill", () => {
      const result = envRequirementSchema.safeParse({
        kind: "required",
        prefilled: null,
      });
      expect(result.success).toBe(true);
      expect(result.data?.prefilled).toBeUndefined();
    });

    it("preserves a non-empty string prefilled", () => {
      const result = envRequirementSchema.safeParse({
        kind: "required",
        prefilled: "default_v",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        kind: "required",
        prefilled: "default_v",
        isSecret: false,
      });
    });

    it("preserves a non-empty fromEnv prefilled", () => {
      const result = envRequirementSchema.safeParse({
        kind: "required",
        prefilled: { fromEnv: "MY_ENV" },
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        kind: "required",
        prefilled: { fromEnv: "MY_ENV" },
      });
    });

    it("works when prefilled is omitted", () => {
      const result = envRequirementSchema.safeParse({ kind: "required" });
      expect(result.success).toBe(true);
      expect(result.data?.prefilled).toBeUndefined();
    });
  });

  describe("optional kind", () => {
    it("drops empty string prefilled → no prefill", () => {
      const result = envRequirementSchema.safeParse({
        kind: "optional",
        prefilled: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.prefilled).toBeUndefined();
    });

    it("preserves a non-empty prefilled", () => {
      const result = envRequirementSchema.safeParse({
        kind: "optional",
        prefilled: "hello",
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        kind: "optional",
        prefilled: "hello",
      });
    });
  });

  describe("fixed kind", () => {
    // `fixed` is left untouched so existing rows still parse — empty values surface
    // as runtime issues at server-connect time rather than parse failures.
    it("leaves empty string prefilled untouched", () => {
      const result = envRequirementSchema.safeParse({
        kind: "fixed",
        prefilled: "",
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ kind: "fixed", prefilled: "" });
    });

    it("leaves null prefilled untouched", () => {
      const result = envRequirementSchema.safeParse({
        kind: "fixed",
        prefilled: null,
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ kind: "fixed", prefilled: null });
    });

    it("preserves a non-empty prefilled", () => {
      const result = envRequirementSchema.safeParse({
        kind: "fixed",
        prefilled: "fixed_val",
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        kind: "fixed",
        prefilled: "fixed_val",
      });
    });
  });
});
