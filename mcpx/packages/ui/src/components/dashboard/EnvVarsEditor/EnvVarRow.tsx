import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TriangleAlert } from "lucide-react";
import {
  EnvVarRowProps,
  EnvVarMode,
  isFromEnv,
  isNull,
  isLiteral,
  getMode,
  isEnvValuesEqual,
  isRequirementSatisfied,
} from "./types";
import { FromEnvInput, LiteralInput, FixedInput } from "./inputs";
import { useState } from "react";

export const EnvVarRow = ({
  envKey,
  requirement,
  value,
  isMissing,
  missingInfo,
  onValueChange,
  disabled,
}: EnvVarRowProps) => {
  const mode = getMode(value);
  const isNullValue = isNull(value);
  const isFixed = requirement.kind === "fixed";
  const isRequired = requirement.kind === "required";

  // Modification check
  const hasPrefilled = requirement.prefilled !== undefined;
  const isModified =
    hasPrefilled && !isEnvValuesEqual(value, requirement.prefilled!);
  const [initialValue] = useState(value);
  const hasChanged = !isEnvValuesEqual(value, initialValue);

  const handleModeChange = (newMode: EnvVarMode) => {
    if (newMode === "fromEnv") {
      // Switch to fromEnv mode with empty env var name
      onValueChange(envKey, { fromEnv: "" });
    } else {
      // Switch to literal mode with empty string
      onValueChange(envKey, "");
    }
  };

  const handleRestorePrefilled = () => {
    if (requirement.prefilled !== undefined) {
      onValueChange(envKey, requirement.prefilled);
    }
  };

  const handleLiteralChange = (newValue: string) => {
    onValueChange(envKey, newValue);
  };

  const handleFromEnvChange = (envVarName: string) => {
    onValueChange(envKey, { fromEnv: envVarName });
  };

  const handleLeaveEmpty = (checked: boolean) => {
    onValueChange(envKey, checked ? null : "");
  };

  const validation = isRequirementSatisfied(requirement, value);
  const isInvalid = !validation.satisfied;

  return (
    <div className="flex items-start gap-3 pt-3 px-2 h-[66px] rounded border border-gray-200 bg-white">
      {/* Status indicator */}
      <div className="flex-shrink-0">
        {(isInvalid || (isMissing && !hasChanged)) && (
          <TriangleAlert className="w-4 h-4 text-orange-500" />
        )}
      </div>

      <div className="w-32 flex-shrink-0 min-w-0 overflow-hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block truncate text-sm font-medium text-gray-700 cursor-default">
              {envKey}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-mono text-xs max-w-xs break-all">{envKey}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Mode selector */}
      <Select
        value={mode}
        onValueChange={(v) => handleModeChange(v as EnvVarMode)}
        disabled={disabled}
      >
        <SelectTrigger className="w-20 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="literal">Value</SelectItem>
          <SelectItem value="fromEnv">Env</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1 min-w-0">
        {isFixed ? (
          <FixedInput
            value={
              isFromEnv(value)
                ? value.fromEnv
                : value === null
                  ? "empty"
                  : String(value)
            }
          />
        ) : mode === "fromEnv" ? (
          <FromEnvInput
            value={isFromEnv(value) ? value.fromEnv : ""}
            onChange={handleFromEnvChange}
            isMissing={isMissing && missingInfo?.type === "fromEnv"}
            disabled={disabled}
            hasPrefilled={hasPrefilled}
            onReset={() => handleRestorePrefilled()}
            isRequired={isRequired}
            isModified={isModified}
          />
        ) : (
          <LiteralInput
            value={isLiteral(value) ? value : ""}
            onChange={handleLiteralChange}
            onLeaveEmpty={handleLeaveEmpty}
            isNull={isNullValue}
            disabled={disabled}
            envKey={envKey}
            hasPrefilled={hasPrefilled}
            onReset={() => handleRestorePrefilled()}
            isRequired={isRequired}
            isModified={isModified}
          />
        )}
        <div className="text-amber-500 text-[10px] font-medium whitespace-nowrap ml-1">
          {isMissing && !hasChanged ? "Missing config" : ""}
        </div>
        <div className="text-red-500 text-[10px] font-medium whitespace-nowrap ml-1">
          {isInvalid && !(isMissing && !hasChanged) ? validation.reason : ""}
        </div>
      </div>
    </div>
  );
};
