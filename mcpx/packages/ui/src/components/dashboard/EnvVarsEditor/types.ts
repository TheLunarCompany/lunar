import { EnvValue, MissingEnvVar } from "@/types";
import type { EnvRequirement } from "@mcpx/shared-model";

export interface UserEnvVarRowProps {
  envKey: string;
  value: EnvValue;
  requirement: EnvRequirement;
  missingInfo?: MissingEnvVar;
  onValueChange: (key: string, value: EnvValue) => void;
  disabled: boolean;
  onKeyChange?: (oldKey: string, newKey: string) => void;
  /** Used by HeadersEditor for literal values — disables literal input. */
  disableLiteralInput?: boolean;
  /** Used by HeadersEditor for literal values — tooltip text to explain why the value option is disabled. */
  literalDisabledTooltip?: string;
}

export interface UserEnvVarsEditorProps {
  env: Record<string, EnvValue>;
  /** Used for reset-to-prefilled (catalog default). When set, reset uses requirement.prefilled. */
  requirements?: Record<string, EnvRequirement>;
  missingEnvVars?: MissingEnvVar[];
  onSave: (env: Record<string, EnvValue>) => void;
  isSaving: boolean;
  hideTitle?: boolean;
}
