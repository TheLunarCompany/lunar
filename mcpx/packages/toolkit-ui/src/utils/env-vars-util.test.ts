import { EnvRequirement, EnvValue } from "@mcpx/shared-model";
import { maskSecretEnvValue, MASKED_SECRET } from "./env-vars-utils.js";

/**
 * Factory function to create EnvRequirement objects for testing.
 */
function createFixedRequirement(overrides?: {
  prefilled?: EnvValue;
  description?: string;
  isSecret?: boolean;
}): EnvRequirement {
  return {
    kind: "fixed",
    prefilled: "value",
    isSecret: false,
    ...overrides,
  };
}

function createEditableRequirement(overrides?: {
  kind: "required" | "optional";
  prefilled?: EnvValue;
  description?: string;
  isSecret?: boolean;
}): EnvRequirement {
  return {
    kind: "optional",
    isSecret: false,
    ...overrides,
  };
}

describe("maskSecretEnvValue", () => {
  // Case 1: value == prefilled, isSecret=true, value is string -> should mask
  describe("when value equals prefilled, isSecret=true, and value is a non-empty string", () => {
    it.each([
      [createFixedRequirement({ prefilled: "my-secret", isSecret: true })],
      [
        createEditableRequirement({
          kind: "optional",
          prefilled: "my-secret",
          isSecret: true,
        }),
      ],
      [
        createEditableRequirement({
          kind: "required",
          prefilled: "my-secret",
          isSecret: true,
        }),
      ],
    ])("kind=$requirement.kind: should mask the value", (requirement) => {
      expect(maskSecretEnvValue("my-secret", requirement)).toBe(MASKED_SECRET);
    });
  });
  // Case 2: value == prefilled, isSecret=true, value is fromEnv -> shouldn't mask
  describe("when value equals prefilled, isSecret=true, and value is fromEnv", () => {
    it.each([
      [
        createFixedRequirement({
          prefilled: { fromEnv: "API_KEY" },
          isSecret: true,
        }),
      ],
      [
        createEditableRequirement({
          kind: "optional",
          prefilled: { fromEnv: "API_KEY" },
          isSecret: true,
        }),
      ],
      [
        createEditableRequirement({
          kind: "required",
          prefilled: { fromEnv: "API_KEY" },
          isSecret: true,
        }),
      ],
    ])(
      "kind=$requirement.kind: should NOT mask fromEnv values",
      (requirement) => {
        expect(maskSecretEnvValue({ fromEnv: "API_KEY" }, requirement)).toEqual(
          { fromEnv: "API_KEY" },
        );
      },
    );
  });
  // Case 3: value == prefilled, isSecret=true, value is null -> shouldn't mask
  describe("when value equals prefilled, isSecret=true, and value is null", () => {
    it.each([
      [createFixedRequirement({ prefilled: null, isSecret: true })],
      [
        createEditableRequirement({
          kind: "optional",
          prefilled: null,
          isSecret: true,
        }),
      ],
      [
        createEditableRequirement({
          kind: "required",
          prefilled: null,
          isSecret: true,
        }),
      ],
    ])("kind=$requirement.kind: should NOT mask null values", (requirement) => {
      expect(maskSecretEnvValue(null, requirement)).toBe(null);
    });
  });
  // Case 4: value != prefilled, isSecret=true -> shouldn't mask
  describe("when value does NOT equal prefilled and isSecret=true", () => {
    describe("with existing prefilled value", () => {
      it.each([
        [createFixedRequirement({ prefilled: "original", isSecret: true })],
        [
          createEditableRequirement({
            kind: "optional",
            prefilled: "original",
            isSecret: true,
          }),
        ],
        [
          createEditableRequirement({
            kind: "required",
            prefilled: "original",
            isSecret: true,
          }),
        ],
      ])(
        "kind=$requirement.kind: should return different string value unmasked",
        (requirement) => {
          expect(maskSecretEnvValue("modified", requirement)).toBe("modified");
        },
      );

      it.each([
        [
          createFixedRequirement({
            prefilled: { fromEnv: "ORIGINAL" },
            isSecret: true,
          }),
        ],
        [
          createEditableRequirement({
            kind: "optional",
            prefilled: { fromEnv: "ORIGINAL" },
            isSecret: true,
          }),
        ],
        [
          createEditableRequirement({
            kind: "required",
            prefilled: { fromEnv: "ORIGINAL" },
            isSecret: true,
          }),
        ],
      ])(
        "kind=$requirement.kind: should return fromEnv value unmasked",
        (requirement) => {
          expect(
            maskSecretEnvValue({ fromEnv: "NEW_KEY" }, requirement),
          ).toEqual({ fromEnv: "NEW_KEY" });
        },
      );

      it.each([
        [createFixedRequirement({ prefilled: "original", isSecret: true })],
        [createEditableRequirement({ kind: "optional", isSecret: true })],
        [createEditableRequirement({ kind: "required", isSecret: true })],
      ])(
        "kind=$requirement.kind: should return null value unmasked",
        (requirement) => {
          expect(maskSecretEnvValue(null, requirement)).toBe(null);
        },
      );
    });
  });

  // Case 5: value == prefilled, isSecret=false, no matter the value -> shouldn't mask
  describe("when value equals prefilled and isSecret=false", () => {
    // literal value
    it.each([
      [createFixedRequirement({ prefilled: "secret", isSecret: false })],
      [
        createEditableRequirement({
          kind: "optional",
          prefilled: "secret",
          isSecret: false,
        }),
      ],
      [
        createEditableRequirement({
          kind: "required",
          prefilled: "secret",
          isSecret: false,
        }),
      ],
    ])(
      "kind=$requirement.kind: should return string value unmasked",
      (requirement) => {
        expect(maskSecretEnvValue("secret", requirement)).toBe("secret");
      },
    );
    // fromEnv value
    it.each([
      [
        createFixedRequirement({
          prefilled: { fromEnv: "KEY" },
          isSecret: false,
        }),
      ],
      [
        createEditableRequirement({
          kind: "optional",
          prefilled: { fromEnv: "KEY" },
          isSecret: false,
        }),
      ],
      [
        createEditableRequirement({
          kind: "required",
          prefilled: { fromEnv: "KEY" },
          isSecret: false,
        }),
      ],
    ])(
      "kind=$requirement.kind: should return fromEnv value unmasked",
      (requirement) => {
        expect(maskSecretEnvValue({ fromEnv: "KEY" }, requirement)).toEqual({
          fromEnv: "KEY",
        });
      },
    );
    // null
    it.each([
      [createFixedRequirement({ prefilled: null, isSecret: false })],
      [
        createEditableRequirement({
          kind: "optional",
          prefilled: null,
          isSecret: false,
        }),
      ],
      [
        createEditableRequirement({
          kind: "required",
          prefilled: null,
          isSecret: false,
        }),
      ],
    ])(
      "kind=$requirement.kind: should return null value unmasked",
      (requirement) => {
        expect(maskSecretEnvValue(null, requirement)).toBe(null);
      },
    );
  });
});
