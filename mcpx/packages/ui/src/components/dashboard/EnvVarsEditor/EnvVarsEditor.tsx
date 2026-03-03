import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EnvValue, MissingEnvVar } from "@/types";
import type { EnvRequirement } from "@mcpx/shared-model";
import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EnvVarRow } from "./EnvVarRow";
import {
  EnvVarsEditorProps,
  isRequirementSatisfied,
  LIST_ITEM_MOTION,
} from "./types";
import { useToast } from "@/components/ui/use-toast";

export const EnvVarsEditor = ({
  env,
  missingEnvVars = [],
  requirements,
  onSave,
  isSaving,
}: EnvVarsEditorProps) => {
  const [editedEnv, setEditedEnv] = useState<Record<string, EnvValue>>(() => ({
    ...env,
  }));
  const { toast } = useToast();
  const initialKeys = Object.keys(env);
  const [keyOrder, setKeyOrder] = useState<string[]>(() => initialKeys);
  const [rowIds] = useState<string[]>(() =>
    initialKeys.map((_, i) => `row-${i}`),
  );

  /** Same as original: effectiveRequirements[key] = requirements?.[key] ?? { kind: "optional" }. */
  const effectiveRequirements = useMemo(
    () =>
      Object.fromEntries(
        keyOrder.map((key) => [
          key,
          requirements?.[key] ?? ({ kind: "optional" } as const),
        ]),
      ) as Record<string, EnvRequirement>,
    [keyOrder, requirements],
  );

  const isMissing = useCallback(
    (key: string): boolean => missingEnvVars.some((mv) => mv.key === key),
    [missingEnvVars],
  );

  const getMissingInfo = useCallback(
    (key: string): MissingEnvVar | undefined =>
      missingEnvVars.find((mv) => mv.key === key),
    [missingEnvVars],
  );

  const hasInvalidEntries = useMemo(
    () =>
      Object.entries(editedEnv).some(([key, value]) => {
        const requirement = effectiveRequirements[key];
        return !isRequirementSatisfied(requirement, value).satisfied;
      }),
    [editedEnv, effectiveRequirements],
  );

  const isOnlyFixed = useMemo(() => {
    // flag to see if there is only fixed vars, to prevent having the "save" button enabled when its not relevant
    const requirementValues = Object.values(effectiveRequirements);
    return requirementValues.every(
      (requirement) => requirement.kind === "fixed",
    );
  }, [effectiveRequirements]);

  const envEntries = useMemo(
    () =>
      keyOrder
        .map(
          (key, i) =>
            [key, editedEnv[key], rowIds[i]] as [
              string,
              EnvValue | undefined,
              string,
            ],
        )
        .filter(
          (entry): entry is [string, EnvValue, string] =>
            entry[1] !== undefined,
        ),
    [keyOrder, editedEnv, rowIds],
  );

  const handleValueChange = (key: string, value: EnvValue) => {
    setEditedEnv((prev) => ({ ...prev, [key]: value }));
  };

  const handleKeyChange = useCallback(
    (oldKey: string, newKey: string) => {
      const trimmed = newKey.trim();
      if (trimmed === "" || trimmed === oldKey) return;
      setKeyOrder((prev) => prev.map((k) => (k === oldKey ? trimmed : k)));
      setEditedEnv((prev) => {
        const next = { ...prev };
        const val = next[oldKey];
        delete next[oldKey];
        next[trimmed] = val;
        onSave(next);
        return next;
      });
    },
    [onSave],
  );

  const handleSave = () => {
    if (hasInvalidEntries) {
      toast({
        title: "Saving failed",
        description: "All variables needs to be valid",
        variant: "destructive",
      });
      return;
    }
    // Convert empty strings to null for optional fields
    const processedEnv = Object.fromEntries(
      Object.entries(editedEnv).map(([key, value]) => {
        const requirement = effectiveRequirements[key];
        // Convert empty string to null for optional fields
        if (requirement.kind === "optional" && value === "") {
          return [key, null];
        }
        return [key, value];
      }),
    );

    onSave(processedEnv);
  };

  return (
    <div className="mb-4">
      <div className="text-sm font-semibold text-foreground mb-3">
        Environment Variables
      </div>
      <TooltipProvider>
        <div className="max-h-[40vh] 2xl:max-h-[55vh] overflow-y-auto space-y-3">
          <AnimatePresence initial={false} mode="sync">
            {envEntries.map(([key, value, rowId]) => (
              <motion.div
                key={rowId}
                layout
                initial={LIST_ITEM_MOTION.initial}
                animate={LIST_ITEM_MOTION.animate}
                exit={LIST_ITEM_MOTION.exit}
                transition={LIST_ITEM_MOTION.transition}
              >
                <EnvVarRow
                  envKey={key}
                  value={value}
                  requirement={effectiveRequirements[key]}
                  isMissing={isMissing(key)}
                  missingInfo={getMissingInfo(key)}
                  onValueChange={handleValueChange}
                  disabled={isSaving}
                  onKeyChange={handleKeyChange}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </TooltipProvider>
      <div className="mt-3 flex justify-end">
        <Button
          variant="primary"
          size="sm"
          className="bg-[#5147E4]"
          onClick={handleSave}
          disabled={isSaving || isOnlyFixed}
        >
          {isSaving ? "Saving..." : "Save & Connect"}
        </Button>
      </div>
    </div>
  );
};
