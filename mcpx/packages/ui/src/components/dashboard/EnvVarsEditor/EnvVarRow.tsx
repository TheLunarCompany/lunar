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
import { UserEnvVarRowProps } from "./types";
import {
  EnvVarMode,
  isFromEnv,
  isNull,
  isLiteral,
  getMode,
  isEnvValuesEqual,
  isRequirementSatisfied,
  TRANSITIONS,
  maskSecretEnvValue,
  isFromSecret,
} from "@mcpx/toolkit-ui/src/utils/env-vars-utils";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FixedInput,
  FromEnvInput,
  FromSecretInput,
  LiteralInput,
} from "./inputs";
import { useGetSecrets } from "@/data/secrets";
import {
  createEnvModeDrafts,
  getValueForMode,
  syncDraftsWithValue,
} from "./drafts";

export const EnvVarRow = ({
  envKey,
  value,
  requirement,
  isMissing,
  onValueChange,
  disabled,
  onKeyChange: _onKeyChange,
}: UserEnvVarRowProps) => {
  const mode = getMode(value);
  const isNullValue = isNull(value);
  const [isExpanded, setIsExpanded] = useState(false);
  const [drafts, setDrafts] = useState(() => createEnvModeDrafts(value));

  const isFixed = requirement.kind === "fixed";
  const isRequired = requirement.kind === "required";
  const hasPrefilled = requirement.prefilled !== undefined;
  const isModified =
    hasPrefilled && !isEnvValuesEqual(value, requirement.prefilled!);
  const [initialValue] = useState(value);
  const hasChanged = !isEnvValuesEqual(value, initialValue);

  const { data: secrets = [], isLoading: isSecretsLoading } = useGetSecrets();

  useEffect(() => {
    setDrafts((prev) => syncDraftsWithValue(prev, value));
  }, [value]);

  const handleModeChange = (newMode: EnvVarMode) => {
    onValueChange(envKey, getValueForMode(drafts, newMode));
  };

  const handleLiteralChange = (newValue: string) => {
    setDrafts((prev) => ({ ...prev, literal: newValue }));
    onValueChange(envKey, newValue);
  };

  const handleFromEnvChange = (envVarName: string) => {
    const nextValue = { fromEnv: envVarName };
    setDrafts((prev) => ({ ...prev, fromEnv: nextValue }));
    onValueChange(envKey, nextValue);
  };

  const handleFromSecretChange = (secretName: string) => {
    const nextValue = { fromSecret: secretName };
    setDrafts((prev) => ({ ...prev, fromSecret: nextValue }));
    onValueChange(envKey, nextValue);
  };

  const handleLeaveEmpty = (checked: boolean) => {
    const nextValue = checked ? null : "";
    setDrafts((prev) => ({ ...prev, literal: nextValue }));
    onValueChange(envKey, nextValue);
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
  const maskedValue = maskSecretEnvValue(value, requirement);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-[#F3F5FA]">
      <Button
        type="button"
        variant="ghost"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 h-auto text-(--color-text-primary) hover:bg-transparent"
        onClick={() => setIsExpanded((prev) => !prev)}
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          {(isRequired || isFixed) && (
            <span className="text-red-500 text-md shrink-0">*</span>
          )}
          <div className="bg-lunar-purpleNew/10 px-1.5 py-0.5 rounded-[4px] max-w-[300px] min-w-0 shrink flex items-center gap-0.5">
            <span className="text-xs text-lunar-purpleNew truncate block min-w-0">
              {envKey}
            </span>
          </div>
          {(isInvalid || (isMissing && !hasChanged)) && (
            <TriangleAlert className="w-4 h-4 text-orange-500 shrink-0" />
          )}
          {isFixed && (
            <span className="text-[8px] border rounded-md border-gray-500 text-gray-500 px-1 py-0.5">
              Set by Admin
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isExpanded && showResetButton && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-(--color-text-secondary) hover:text-(--color-text-primary)"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              disabled={disabled}
              aria-label="Reset to prefilled value"
              title="Reset to prefilled value"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          <span className="h-8 w-8 shrink-0 inline-flex items-center justify-center text-(--color-text-secondary)">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        </div>
      </Button>

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
                    isFromEnv(maskedValue)
                      ? maskedValue.fromEnv
                      : isFromSecret(maskedValue)
                        ? maskedValue.fromSecret
                        : maskedValue === null
                          ? "empty"
                          : maskedValue
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
                      <span className="text-sm text-(--color-text-primary)">
                        Value
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="fromEnv"
                        id={`mode-fromEnv-${envKey}`}
                      />
                      <span className="text-sm text-(--color-text-primary)">
                        Load from env
                      </span>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex p-0.5 rounded text-(--color-text-secondary) hover:text-(--color-text-primary) focus:outline-hidden focus-visible:ring-2 focus-visible:ring-(--color-fg-interactive)"
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
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="fromSecret"
                        id={`mode-fromSecret-${envKey}`}
                      />
                      <span className="text-sm text-(--color-text-primary)">
                        Load from Secret
                      </span>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex p-0.5 rounded text-(--color-text-secondary) hover:text-(--color-text-primary) focus:outline-hidden focus-visible:ring-2 focus-visible:ring-(--color-fg-interactive)"
                              aria-label="Load value from secret"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Load value from secret
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </label>
                  </RadioGroup>
                  {mode === "fromSecret" ? (
                    <FromSecretInput
                      value={isFromSecret(value) ? value.fromSecret : ""}
                      onChange={handleFromSecretChange}
                      disabled={disabled}
                      secrets={secrets}
                      isLoading={isSecretsLoading}
                    />
                  ) : mode === "fromEnv" ? (
                    <FromEnvInput
                      value={isFromEnv(value) ? value.fromEnv : ""}
                      onChange={handleFromEnvChange}
                      disabled={disabled}
                    />
                  ) : (
                    <LiteralInput
                      value={isLiteral(maskedValue) ? maskedValue : ""}
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
                {isMissing && !hasChanged
                  ? "Missing configuration. Try another value or contact your admin."
                  : ""}
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
