import { envRequirementSchema } from "./request-schemas.js";

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
