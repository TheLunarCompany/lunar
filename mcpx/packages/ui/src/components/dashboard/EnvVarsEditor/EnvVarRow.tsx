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
import { FixedInput, LiteralInput } from "./inputs";
import { EnvReferenceInput } from "./inputs/EnvReferenceInput";
import { useGetSecrets } from "@/data/secrets";
import {
  createEnvModeDrafts,
  getValueForMode,
  syncDraftsWithValue,
} from "./utils/envModeDrafts";
import { EnvValue } from "@/types";

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
  const editorMode = mode === "literal" ? "literal" : "fromEnv";
  const isNullValue = isNull(value);
  const [isExpanded, setIsExpanded] = useState(false);
  const [drafts, setDrafts] = useState(() => createEnvModeDrafts(value));
  const [hasReferenceDraftError, setHasReferenceDraftError] = useState(false);

  const isFixed = requirement.kind === "fixed";
  const isRequired = requirement.kind === "required";
  const isSecret = requirement.isSecret;
  const hasPrefilled = requirement.prefilled !== undefined;
  const isModified =
    hasPrefilled && !isEnvValuesEqual(value, requirement.prefilled!);
  const [initialValue] = useState(value);
  const hasChanged = !isEnvValuesEqual(value, initialValue);

  const { data: secrets = [], isLoading: isSecretsLoading } = useGetSecrets();

  useEffect(() => {
    setDrafts((prev) => syncDraftsWithValue(prev, value));
  }, [value]);

  const handleModeChange = (newMode: "literal" | "fromEnv") => {
    if (newMode === "literal") {
      onValueChange(envKey, getValueForMode(drafts, "literal"));
      return;
    }

    if (isFromSecret(value) || isFromEnv(value)) {
      onValueChange(envKey, value);
      return;
    }

    const fromSecretDraft = getValueForMode(drafts, "fromSecret");
    const fromEnvDraft = getValueForMode(drafts, "fromEnv");

    if (isFromSecret(fromSecretDraft) && fromSecretDraft.fromSecret.trim()) {
      onValueChange(envKey, fromSecretDraft);
      return;
    }

    onValueChange(envKey, fromEnvDraft);
  };

  const handleLiteralChange = (newValue: string) => {
    setDrafts((prev) => ({ ...prev, literal: newValue }));
    onValueChange(envKey, newValue);
  };

  const handleReferenceChange = (
    nextMode: "fromEnv" | "fromSecret",
    referenceName: string,
  ) => {
    const nextValue =
      nextMode === "fromEnv"
        ? { fromEnv: referenceName }
        : { fromSecret: referenceName };
    setDrafts((prev) => ({ ...prev, [nextMode]: nextValue }));
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
  const showMissingWarning =
    isMissing && !hasChanged && !hasReferenceDraftError;
  const maskedValue = maskSecretEnvValue(value, requirement);

  const getEnvReferenceValue = (value: EnvValue) => {
    if (isFromSecret(value)) {
      return value.fromSecret;
    }

    if (isFromEnv(value)) {
      return value.fromEnv;
    }

    return "";
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-[#F3F5FA]">
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-(--color-text-primary)">
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded((prev) => !prev)}
            disabled={disabled}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse variable" : "Expand variable"}
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
                    value={editorMode}
                    onValueChange={(v) =>
                      handleModeChange(v as "literal" | "fromEnv")
                    }
                    disabled={disabled}
                    className="flex flex-row gap-6"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="literal"
                        id={`mode-literal-${envKey}`}
                      />
                      <span className="text-sm text-foreground">Value</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem
                        value="fromEnv"
                        id={`mode-fromEnv-${envKey}`}
                      />
                      <span className="text-sm text-foreground">
                        Load from env
                      </span>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex p-0.5 rounded text-muted-foreground hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                              aria-label="Load value from another environment variable or secret"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Type an environment variable name or choose a secret
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </label>
                  </RadioGroup>
                  {mode === "fromSecret" || mode === "fromEnv" ? (
                    <EnvReferenceInput
                      value={getEnvReferenceValue(maskedValue)}
                      onChange={handleReferenceChange}
                      onDraftValidationChange={(hasError) => {
                        setHasReferenceDraftError(hasError);
                      }}
                      disabled={disabled}
                      secrets={secrets}
                      isLoading={isSecretsLoading}
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
                      isSecret={isSecret}
                    />
                  )}
                </>
              )}
            </div>
            <div className="min-h-5 mt-1">
              <div className="text-amber-500 text-[10px] font-medium whitespace-nowrap">
                {showMissingWarning
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
