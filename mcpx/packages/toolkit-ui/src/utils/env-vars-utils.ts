import {
  envRequirementsSchema,
  type CatalogConfig,
  type EnvRequirement,
  type EnvRequirements,
  type UpdateTargetServerRequest,
  type EnvValue,
} from "@mcpx/shared-model";
import { z } from "zod/v4";
export type { EnvValue } from "@mcpx/shared-model";

export const MASKED_SECRET = "*".repeat(8);

// Type guards for EnvValue
export const isLiteral = (value: EnvValue): value is string =>
  typeof value === "string";
export const isNull = (value: EnvValue): value is null => value === null;
export const isFromEnv = (value: EnvValue): value is { fromEnv: string } =>
  !isLiteral(value) && !isNull(value) && "fromEnv" in value;
export const isFromSecret = (
  value: EnvValue,
): value is { fromSecret: string } =>
  !isLiteral(value) && !isNull(value) && "fromSecret" in value;

export type EnvVarMode = "literal" | "fromEnv" | "fromSecret";

export const getMode = (value: EnvValue): EnvVarMode => {
  if (isFromEnv(value)) return "fromEnv";
  if (isFromSecret(value)) return "fromSecret";
  return "literal";
};

export const getEnvValue = (value: EnvValue): string | null => {
  if (isFromEnv(value)) return value.fromEnv;
  if (isFromSecret(value)) return value.fromSecret;
  return value;
};

export const isValidEnvValue = (value: EnvValue): boolean => {
  if (value === null) return true; // intentionally empty
  if (isLiteral(value)) return value.trim() !== ""; // non-empty string
  if (isFromEnv(value)) return value.fromEnv.trim() !== ""; // non-empty env var name
  if (isFromSecret(value)) return value.fromSecret.trim() !== ""; // non-empty secret name
  return false;
};

type RequirementValidationResult =
  | { satisfied: true }
  | { satisfied: false; reason: string };

export const isEnvValuesEqual = (
  inputValue: EnvValue,
  originalValue: EnvValue,
): boolean => {
  // check if one or both are null
  if (isNull(inputValue) && isNull(originalValue)) return true;
  if (isNull(inputValue) || isNull(originalValue)) return false;
  // check if both literal and if not - compare
  if (isLiteral(inputValue) && isLiteral(originalValue))
    return inputValue === originalValue;
  if (isLiteral(inputValue) || isLiteral(originalValue)) return false;
  // check if both FromEnv and if not - compare
  if (isFromEnv(inputValue) && isFromEnv(originalValue))
    return inputValue.fromEnv === originalValue.fromEnv;
  // check if both FromSecret and if not - compare
  if (isFromSecret(inputValue) && isFromSecret(originalValue))
    return inputValue.fromSecret === originalValue.fromSecret;
  return false;
};

export const isRequirementSatisfied = (
  requirement: EnvRequirement,
  value: EnvValue,
): RequirementValidationResult => {
  const actualValue = getEnvValue(value);

  if (requirement.kind === "fixed") {
    const isModified = !isEnvValuesEqual(value, requirement.prefilled);
    if (isModified) {
      // A fixed env var current value has been changed by the user - shouldn't be allowed
      return { satisfied: false, reason: "Fixed value cannot be modified" };
    }
    return { satisfied: true };
  }

  // Optional can be empty string (will be converted to null at saving) or simply null
  if (
    requirement.kind === "optional" &&
    (actualValue === null || actualValue === "")
  ) {
    return { satisfied: true };
  }

  if (actualValue === null || actualValue === "") {
    // if we got here and actualValue still empty, the re kind is "Required"
    // required can't be null or empty
    return {
      satisfied: false,
      reason: "Required variables cannot be empty",
    };
  }

  if (actualValue.trim() === "") {
    return { satisfied: false, reason: "cannot be whitespace-only" };
  }

  return { satisfied: true };
};

export function maskSecretEnvValue(
  value: EnvValue,
  requirement: EnvRequirement,
): EnvValue {
  const prefilledValue = requirement.prefilled;
  if (prefilledValue === undefined || prefilledValue === null) {
    return value;
  }
  if (requirement.isSecret === undefined || requirement.isSecret === false) {
    // we mask only when isSecret is defined and is true
    return value;
  }
  if (!isEnvValuesEqual(value, prefilledValue)) {
    // if the value has been edited - no need to mask
    return value;
  }
  // values are equal - hide it (even if it's a fromEnv or from Secret) and don't change the mode
  if (isFromEnv(prefilledValue)) {
    return { fromEnv: MASKED_SECRET };
  }
  if (isFromSecret(prefilledValue)) {
    return { fromSecret: MASKED_SECRET };
  }
  if (isLiteral(prefilledValue) && prefilledValue.trim() !== "") {
    return MASKED_SECRET; //return long mask for non-empty secrets
  }
  return MASKED_SECRET; //return long mask as default
}

// ============================================
// Helpers - EnvRequirement → Record<string, EnvValue> conversion
// ============================================

export function convertRequirementsToValues(
  env: Record<string, EnvRequirement>,
): Record<string, EnvValue> {
  if (!env) {
    return {};
  }
  const result: Record<string, EnvValue> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value.kind === "fixed") {
      result[key] = value.prefilled;
    } else if (value.kind === "required") {
      result[key] = value.prefilled ?? "";
    } else if (value.kind === "optional") {
      result[key] = value.prefilled ?? ""; // TODO [RND-152] revert back to "null" for optional vars after admin can declare env vars as required or optional
    }
  }
  return result;
}

export function validateAndBuildCatalogConfig(
  serverConfig: UpdateTargetServerRequest,
  envRequirements: EnvRequirements,
):
  | { success: true; config: CatalogConfig }
  | { success: false; error: string } {
  // For non-stdio servers, leave untouched
  if (serverConfig.type !== "stdio") {
    return { success: true, config: serverConfig };
  }

  // Validate envRequirements
  const requirementsValidation =
    envRequirementsSchema.safeParse(envRequirements);
  if (!requirementsValidation.success) {
    return {
      success: false,
      error: `Invalid environment details: ${z.prettifyError(requirementsValidation.error)}`,
    };
  }

  // Check that all env vars from JSON have corresponding requirements
  const jsonEnvKeys = new Set(Object.keys(serverConfig.env || {}));
  const requirementsKeys = new Set(Object.keys(envRequirements));

  const missingRequirements = [...jsonEnvKeys].filter(
    (key) => !requirementsKeys.has(key),
  );

  if (missingRequirements.length > 0) {
    return {
      success: false,
      error: `Missing environment variable details for: ${missingRequirements.join(", ")}`,
    };
  }

  // Build final config with validated requirements
  return {
    success: true,
    config: {
      ...serverConfig,
      env: requirementsValidation.data,
    },
  };
}

export const LIST_ITEM_MOTION = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: {
    type: "tween" as const,
    duration: 0.28,
    ease: [0.25, 0.1, 0.25, 1] as const,
  },
};

export const TRANSITIONS = {
  expand: {
    type: "tween" as const,
    duration: 0.12,
    ease: "easeOut" as const,
  },
} as const;

export interface EditableEnvVarInputProps {
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
}

export interface LiteralInputProps extends EditableEnvVarInputProps {
  onLeaveEmpty: (checked: boolean) => void;
  isNull: boolean;
  envKey: string;
  isRequired: boolean;
  isSecret: boolean;
}

export interface FromSecretInputProps extends EditableEnvVarInputProps {
  secrets: string[];
  isLoading: boolean;
}

export interface EnvVarRowProps {
  envKey: string;
  value: EnvValue;
  requirement: EnvRequirement;
  isMissing: boolean;
  onValueChange: (key: string, value: EnvValue) => void;
  disabled: boolean;
}

export interface EnvVarsEditorProps {
  env: Record<string, EnvValue>;
  /** Used for reset-to-prefilled (catalog default). When set, reset uses requirement.prefilled. */
  requirements?: Record<string, EnvRequirement>;
  onSave: (env: Record<string, EnvValue>) => void;
  isSaving: boolean;
}
