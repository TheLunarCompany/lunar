import { EnvValue, MissingEnvVar } from "@/types";

// Type guards for EnvValue
export const isLiteral = (value: EnvValue): value is string =>
  typeof value === "string";
export const isNull = (value: EnvValue): value is null => value === null;
export const isFromEnv = (value: EnvValue): value is { fromEnv: string } =>
  !isLiteral(value) && !isNull(value);

export type EnvVarMode = "literal" | "fromEnv";

export const getMode = (value: EnvValue): EnvVarMode =>
  isFromEnv(value) ? "fromEnv" : "literal";

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
