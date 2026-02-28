import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  TriangleAlert,
  Info,
} from "lucide-react";
import {
  EnvVarRowProps,
  EnvVarMode,
  isFromEnv,
  isNull,
  isLiteral,
  getMode,
  isEnvValuesEqual,
  isRequirementSatisfied,
  TRANSITIONS,
} from "./types";
import { useState } from "react";
import { motion } from "framer-motion";
import { FixedInput, FromEnvInput, LiteralInput } from "./inputs";
export const EnvVarRow = ({
  envKey,
  value,
  requirement,
  isMissing,
  missingInfo,
  onValueChange,
  disabled,
  onKeyChange: _onKeyChange,
}: EnvVarRowProps) => {
  const mode = getMode(value);
  const isNullValue = isNull(value);
  const [isExpanded, setIsExpanded] = useState(false);

  const isFixed = requirement.kind === "fixed";
  const isRequired = requirement.kind === "required";
  const hasPrefilled = requirement.prefilled !== undefined;
  const isModified =
    hasPrefilled && !isEnvValuesEqual(value, requirement.prefilled!);
  const [initialValue] = useState(value);
  const hasChanged = !isEnvValuesEqual(value, initialValue);

  const handleModeChange = (newMode: EnvVarMode) => {
    if (newMode === "fromEnv") {
      onValueChange(envKey, { fromEnv: "" });
    } else {
      onValueChange(envKey, "");
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

  /** Reset to prefilled (catalog default) only. No prefilled → no reset button. */
  const handleReset = () => {
    if (hasPrefilled && isModified) {
      onValueChange(envKey, requirement.prefilled!);
    }
  };

  const showResetButton = hasPrefilled && isModified;

  const validation = isRequirementSatisfied(requirement, value);
  const isInvalid = !validation.satisfied;

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-[#F3F5FA]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[var(--color-text-primary)] ">
        <div className="flex items-center gap-2">
          {(isRequired || isFixed) && (
            <span className="text-red-500 text-md flex-shrink-0">*</span>
          )}
          <div className="bg-lunar-purpleNew/10 px-1.5 py-0.5 rounded-[4px] max-w-[300px] min-w-0 shrink flex items-center gap-0.5">
            <span className="text-xs text-lunar-purpleNew truncate block min-w-0">
              {envKey}
            </span>
          </div>
          {(isInvalid || (isMissing && !hasChanged)) && (
            <TriangleAlert className="w-4 h-4 text-orange-500 flex-shrink-0" />
          )}
          {isFixed && (
            <span className="text-[8px] border rounded-md border-gray-500 text-gray-500 px-1 py-0.5">
              Set by Admin
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isExpanded && showResetButton && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              onClick={handleReset}
              disabled={disabled}
              aria-label="Reset to prefilled value"
              title="Reset to prefilled value"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={() => setIsExpanded((prev) => !prev)}
            disabled={disabled}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{
          height: isExpanded ? "auto" : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        transition={TRANSITIONS.expand}
        className="overflow-hidden"
      >
        <div className="px-3 pb-3 pt-0 space-y-3">
          <div>
            <div className="flex flex-col gap-3">
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
              ) : (
                <>
                  <RadioGroup
                    value={mode}
                    onValueChange={(v) => handleModeChange(v as EnvVarMode)}
                    disabled={disabled}
                    className="flex flex-row gap-6"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="literal"
                        id={`mode-literal-${envKey}`}
                      />
                      <span className="text-sm text-[var(--color-text-primary)]">
                        Value
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="fromEnv"
                        id={`mode-fromEnv-${envKey}`}
                      />
                      <span className="text-sm text-[var(--color-text-primary)]">
                        Load from env
                      </span>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex p-0.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-interactive)]"
                              aria-label="Load value from another environment variable"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Load value from another environment variable
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </label>
                  </RadioGroup>
                  {mode === "fromEnv" ? (
                    <FromEnvInput
                      value={isFromEnv(value) ? value.fromEnv : ""}
                      onChange={handleFromEnvChange}
                      isMissing={isMissing && missingInfo?.type === "fromEnv"}
                      disabled={disabled}
                    />
                  ) : (
                    <LiteralInput
                      value={isLiteral(value) ? value : ""}
                      onChange={handleLiteralChange}
                      onLeaveEmpty={handleLeaveEmpty}
                      isNull={isNullValue}
                      disabled={disabled}
                      envKey={envKey}
                      isRequired={isRequired}
                    />
                  )}
                </>
              )}
            </div>
            <div className="min-h-5 ml-1 mt-1">
              <div className="text-amber-500 text-[10px] font-medium whitespace-nowrap">
                {isMissing && !hasChanged ? "Missing config" : ""}
              </div>
              <div className="text-red-500 text-[10px] font-medium whitespace-nowrap">
                {isInvalid && !(isMissing && !hasChanged)
                  ? validation.reason
                  : ""}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
