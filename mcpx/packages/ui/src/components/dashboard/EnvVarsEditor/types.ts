import { EnvValue, MissingEnvVar } from "@/types";
import type { EnvRequirement } from "@mcpx/shared-model";

// Type guards for EnvValue
export const isLiteral = (value: EnvValue): value is string =>
  typeof value === "string";
export const isNull = (value: EnvValue): value is null => value === null;
export const isFromEnv = (value: EnvValue): value is { fromEnv: string } =>
  !isLiteral(value) && !isNull(value);

export type EnvVarMode = "literal" | "fromEnv";

export const getMode = (value: EnvValue): EnvVarMode =>
  isFromEnv(value) ? "fromEnv" : "literal";

export const isValidEnvValue = (value: EnvValue): boolean => {
  if (value === null) return true; // intentionally empty
  if (isLiteral(value)) return value.trim() !== ""; // non-empty string
  if (isFromEnv(value)) return value.fromEnv.trim() !== ""; // non-empty env var name
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
  return false;
};

export const isRequirementSatisfied = (
  requirement: EnvRequirement,
  value: EnvValue,
): RequirementValidationResult => {
  const actualValue: string | null = isFromEnv(value) ? value.fromEnv : value;

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
    return { satisfied: false, reason: "Required field cannot be empty" };
  }

  if (actualValue.trim() === "") {
    return { satisfied: false, reason: "cannot be whitespace-only" };
  }

  return { satisfied: true };
};

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
/** Used by ServerCard for catalog env editing. */
export interface EnvVarState {
  key: string;
  currentValue: EnvValue;
  savedValue: EnvValue | undefined;
  prefilled: EnvValue | undefined;
  requirement: EnvRequirement;
  isUserModified: boolean;
}

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
}

export interface FromEnvInputProps extends EditableEnvVarInputProps {
  isMissing: boolean;
}

export interface EnvVarRowProps {
  envKey: string;
  value: EnvValue;
  requirement: EnvRequirement;
  isMissing: boolean;
  missingInfo?: MissingEnvVar;
  onValueChange: (key: string, value: EnvValue) => void;
  disabled: boolean;
  onKeyChange?: (oldKey: string, newKey: string) => void;
}

export interface EnvVarsEditorProps {
  env: Record<string, EnvValue>;
  /** Used for reset-to-prefilled (catalog default). When set, reset uses requirement.prefilled. */
  requirements?: Record<string, EnvRequirement>;
  missingEnvVars?: MissingEnvVar[];
  onSave: (env: Record<string, EnvValue>) => void;
  isSaving: boolean;
}
