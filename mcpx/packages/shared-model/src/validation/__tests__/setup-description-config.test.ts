import { describe, expect, it } from "@jest/globals";
import {
  setupDescriptionSchema,
  SETUP_DESCRIPTION_CONFIG,
} from "../setup-description-config.js";

describe("setupDescriptionSchema", () => {
  describe("max length validation", () => {
    it("accepts exactly 200 characters", () => {
      const desc200 = "a".repeat(200);
      const result = setupDescriptionSchema.safeParse(desc200);
      expect(result.success).toBe(true);
    });

    it("rejects 201 characters", () => {
      const desc201 = "a".repeat(201);
      const result = setupDescriptionSchema.safeParse(desc201);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("cannot exceed 200");
      }
    });

    it("rejects very long strings", () => {
      const descLong = "a".repeat(1000);
      const result = setupDescriptionSchema.safeParse(descLong);
      expect(result.success).toBe(false);
    });
  });

  describe("empty/whitespace validation", () => {
    it("rejects empty string", () => {
      const result = setupDescriptionSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("cannot be empty");
      }
    });

    it("rejects whitespace-only string after trim", () => {
      const result = setupDescriptionSchema.safeParse("   \t  ");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("cannot be empty");
      }
    });

    it("trims leading/trailing whitespace", () => {
      const result = setupDescriptionSchema.safeParse("  valid description  ");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("valid description");
      }
    });
  });

  describe("allowed character validation", () => {
    it("accepts lowercase letters", () => {
      const result = setupDescriptionSchema.safeParse("abc");
      expect(result.success).toBe(true);
    });

    it("accepts uppercase letters", () => {
      const result = setupDescriptionSchema.safeParse("ABC");
      expect(result.success).toBe(true);
    });

    it("accepts numbers", () => {
      const result = setupDescriptionSchema.safeParse("123");
      expect(result.success).toBe(true);
    });

    it("accepts spaces", () => {
      const result = setupDescriptionSchema.safeParse("hello world");
      expect(result.success).toBe(true);
    });

    it("accepts hyphens", () => {
      const result = setupDescriptionSchema.safeParse("prod-config");
      expect(result.success).toBe(true);
    });

    it("accepts underscores", () => {
      const result = setupDescriptionSchema.safeParse("prod_config");
      expect(result.success).toBe(true);
    });

    it("accepts parentheses", () => {
      const result = setupDescriptionSchema.safeParse("config (prod)");
      expect(result.success).toBe(true);
    });

    it("accepts commas", () => {
      const result = setupDescriptionSchema.safeParse("GitHub, Slack");
      expect(result.success).toBe(true);
    });

    it("accepts periods", () => {
      const result = setupDescriptionSchema.safeParse("v1.0");
      expect(result.success).toBe(true);
    });

    it("accepts exclamation marks", () => {
      const result = setupDescriptionSchema.safeParse("Live Config!");
      expect(result.success).toBe(true);
    });

    it("accepts question marks", () => {
      const result = setupDescriptionSchema.safeParse("Config?");
      expect(result.success).toBe(true);
    });

    it("accepts ampersands", () => {
      const result = setupDescriptionSchema.safeParse("GitHub & Slack");
      expect(result.success).toBe(true);
    });

    it("accepts colons", () => {
      const result = setupDescriptionSchema.safeParse("Env: Production");
      expect(result.success).toBe(true);
    });

    it("accepts single quotes", () => {
      const result = setupDescriptionSchema.safeParse("John's Config");
      expect(result.success).toBe(true);
    });

    it("accepts double quotes", () => {
      const result = setupDescriptionSchema.safeParse('Config "Live"');
      expect(result.success).toBe(true);
    });
  });

  describe("disallowed character validation", () => {
    it("rejects at signs", () => {
      const result = setupDescriptionSchema.safeParse("test@config");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Invalid characters");
      }
    });

    it("rejects forward slashes", () => {
      const result = setupDescriptionSchema.safeParse("prod/staging");
      expect(result.success).toBe(false);
    });

    it("rejects emoji", () => {
      const result = setupDescriptionSchema.safeParse("🚀 Production");
      expect(result.success).toBe(false);
    });

    it("rejects strings with only newlines (becomes empty after trim)", () => {
      const result = setupDescriptionSchema.safeParse("\n");
      expect(result.success).toBe(false);
    });

    it("rejects strings with only tabs (becomes empty after trim)", () => {
      const result = setupDescriptionSchema.safeParse("\t");
      expect(result.success).toBe(false);
    });

    it("rejects embedded tabs", () => {
      const result = setupDescriptionSchema.safeParse("Config\tProduction");
      expect(result.success).toBe(false);
    });

    it("rejects embedded newlines", () => {
      const result = setupDescriptionSchema.safeParse("Config\nProduction");
      expect(result.success).toBe(false);
    });

    it("rejects unicode characters", () => {
      const result = setupDescriptionSchema.safeParse("Config für Testing");
      expect(result.success).toBe(false);
    });

    it("rejects asterisks", () => {
      const result = setupDescriptionSchema.safeParse("*important*");
      expect(result.success).toBe(false);
    });

    it("rejects backslashes", () => {
      const result = setupDescriptionSchema.safeParse("path\\to\\config");
      expect(result.success).toBe(false);
    });

    it("rejects angle brackets", () => {
      const result = setupDescriptionSchema.safeParse(
        "<script>alert(1)</script>",
      );
      expect(result.success).toBe(false);
    });

    it("rejects SQL injection-like strings", () => {
      const result = setupDescriptionSchema.safeParse("' OR '1'='1");
      expect(result.success).toBe(false);
    });
  });

  describe("config constant", () => {
    it("exports maxLength as 200", () => {
      expect(SETUP_DESCRIPTION_CONFIG.maxLength).toBe(200);
    });

    it("exports allowedCharPattern as regex", () => {
      expect(SETUP_DESCRIPTION_CONFIG.allowedCharPattern).toBeInstanceOf(
        RegExp,
      );
    });

    it("exports allowedCharDescription string", () => {
      expect(typeof SETUP_DESCRIPTION_CONFIG.allowedCharDescription).toBe(
        "string",
      );
      expect(SETUP_DESCRIPTION_CONFIG.allowedCharDescription).toContain(
        "letters",
      );
    });
  });
});
