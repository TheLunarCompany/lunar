import { consumerConfigSchema } from "./next-version.js";

describe("consumerConfigSchema", () => {
  describe("with _type present", () => {
    it("parses default-block config", () => {
      const result = consumerConfigSchema.safeParse({
        _type: "default-block",
        allow: ["tool-group-1"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        allow: ["tool-group-1"],
      });
    });

    it("parses default-allow config", () => {
      const result = consumerConfigSchema.safeParse({
        _type: "default-allow",
        block: ["tool-group-1"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-allow",
        block: ["tool-group-1"],
      });
    });

    it("preserves consumerGroupKey", () => {
      const result = consumerConfigSchema.safeParse({
        _type: "default-block",
        consumerGroupKey: "cursor-vscode Profile",
        allow: ["foo"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        consumerGroupKey: "cursor-vscode Profile",
        allow: ["foo"],
      });
    });
  });

  describe("with _type missing (legacy data)", () => {
    it("infers default-block from allow field", () => {
      const result = consumerConfigSchema.safeParse({
        allow: ["tool-group-1"],
        consumerGroupKey: "cursor-vscode Profile",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        consumerGroupKey: "cursor-vscode Profile",
        allow: ["tool-group-1"],
      });
    });

    it("infers default-allow from block field", () => {
      const result = consumerConfigSchema.safeParse({
        block: ["admin-tools"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-allow",
        block: ["admin-tools"],
      });
    });

    it("infers default-block from empty allow array", () => {
      const result = consumerConfigSchema.safeParse({
        allow: [],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        allow: [],
      });
    });

    it("infers default-allow from empty block array", () => {
      const result = consumerConfigSchema.safeParse({
        block: [],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-allow",
        block: [],
      });
    });
  });

  describe("invalid data", () => {
    it("rejects config with neither allow nor block", () => {
      const result = consumerConfigSchema.safeParse({
        consumerGroupKey: "test",
      });
      expect(result.success).toBe(false);
    });

    it("rejects null", () => {
      const result = consumerConfigSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it("rejects wrong _type value", () => {
      const result = consumerConfigSchema.safeParse({
        _type: "default-deny",
        allow: ["foo"],
      });
      expect(result.success).toBe(false);
    });

    it("when both allow and block are present, allow wins (infers default-block)", () => {
      const result = consumerConfigSchema.safeParse({
        allow: ["foo"],
        block: ["bar"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        allow: ["foo"],
      });
    });
  });
});
