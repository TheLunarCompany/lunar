import { EnvRequirement, EnvValue } from "@mcpx/shared-model";
import { maskSecretEnvValue, MASKED_SECRET } from "./env-vars-utils.js";

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
  describe("when isSecret=true, should always mask", () => {
    it.each([
      ["string value", "my-secret"],
      ["fromEnv value", { fromEnv: "API_KEY" }],
      ["null value", null],
    ] as [string, EnvValue][])("should mask %s", (_label, value) => {
      const requirement = createFixedRequirement({ isSecret: true });
      expect(maskSecretEnvValue(value, requirement)).toBe(MASKED_SECRET);
    });

    it.each([
      [createFixedRequirement({ isSecret: true })],
      [createEditableRequirement({ kind: "optional", isSecret: true })],
      [createEditableRequirement({ kind: "required", isSecret: true })],
    ])(
      "kind=$requirement.kind: should mask regardless of kind",
      (requirement) => {
        expect(maskSecretEnvValue("secret", requirement)).toBe(MASKED_SECRET);
      },
    );
  });

  describe("when isSecret=false, should never mask", () => {
    it.each([
      ["string value", "secret", "secret"],
      ["fromEnv value", { fromEnv: "KEY" }, { fromEnv: "KEY" }],
      ["null value", null, null],
    ] as [string, EnvValue, EnvValue][])(
      "should return %s unmasked",
      (_label, value, expected) => {
        const requirement = createFixedRequirement({ isSecret: false });
        expect(maskSecretEnvValue(value, requirement)).toEqual(expected);
      },
    );

    it.each([
      [createFixedRequirement({ isSecret: false })],
      [createEditableRequirement({ kind: "optional", isSecret: false })],
      [createEditableRequirement({ kind: "required", isSecret: false })],
    ])(
      "kind=$requirement.kind: should not mask regardless of kind",
      (requirement) => {
        expect(maskSecretEnvValue("secret", requirement)).toBe("secret");
      },
    );
  });
});
