import { EnvValue, MissingEnvVar } from "@/types";
import { EnvRequirement } from "@mcpx/shared-model";

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
export const isRequirementSatisfied = (
  requirement: EnvRequirement,
  value: EnvValue,
): RequirementValidationResult => {
  if (requirement.kind === "fixed") {
    const isModified = !isEnvValuesEqual(value, requirement.prefilled);
    if (isModified) {
      // A fixed env var current value has been changed by the user - shouldn't be allowed
      return { satisfied: false, reason: "Fixed value cannot be modified" };
    }
    return { satisfied: true };
  }

  // Optional can be empty string (will be converted to null at saving)
  if (requirement.kind === "optional" && value === "") {
    return { satisfied: true };
  }

  if (requirement.kind === "required" && value === null) {
    // required can't be null
    return { satisfied: false, reason: "Required field cannot be empty" };
  }

  const isValid = isValidEnvValue(value); // Reject empty strings for required and whitespace-only strings for both (optional empty strings handled above).
  if (!isValid) {
    return { satisfied: false, reason: "cannot be whitespace-only" };
  }
  return { satisfied: true };
};

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
  if (isFromEnv(inputValue) && isFromEnv(originalValue)) {
    return inputValue.fromEnv === originalValue.fromEnv;
  }
  return false;
};

export interface EnvVarState {
  key: string;
  currentValue: EnvValue;
  savedValue: EnvValue | undefined;
  prefilled: EnvValue | undefined;
  requirement: EnvRequirement;
  isUserModified: boolean;
}

export interface EnvVarRowProps {
  envKey: string;
  value: EnvValue;
  isMissing: boolean;
  missingInfo?: MissingEnvVar;
  onValueChange: (key: string, value: EnvValue) => void;
  disabled: boolean;
}

export interface EnvVarsEditorProps {
  env: Record<string, EnvValue>;
  missingEnvVars?: MissingEnvVar[];
  onSave: (env: Record<string, EnvValue>) => void;
  isSaving: boolean;
}

export interface EditableEnvVarInputProps {
  disabled: boolean;
  value: string;
  isRequired: boolean;
  isModified?: boolean;
  hasPrefilled?: boolean;
  onReset?: () => void;
  onChange: (value: string) => void;
}

export interface LiteralInputProps extends EditableEnvVarInputProps {
  onLeaveEmpty: (checked: boolean) => void;
  isNull: boolean;
  envKey: string;
}

export interface FromEnvInputProps extends EditableEnvVarInputProps {
  isMissing: boolean;
}
