import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EnvValue, MissingEnvVar } from "@/types";
import { useState, useMemo, useCallback } from "react";
import { EnvVarRow } from "./EnvVarRow";
import { EnvVarsEditorProps, isRequirementSatisfied } from "./types";
import { EnvRequirement } from "@mcpx/shared-model";
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

  const isMissing = useCallback(
    (key: string): boolean => missingEnvVars.some((mv) => mv.key === key),
    [missingEnvVars],
  );

  const getMissingInfo = useCallback(
    (key: string): MissingEnvVar | undefined =>
      missingEnvVars.find((mv) => mv.key === key),
    [missingEnvVars],
  );

  // Sort: missing first, then resolved
  const sortedEnvEntries = useMemo(() => {
    const entries = Object.entries(editedEnv);
    return entries.sort(([keyA], [keyB]) => {
      const aMissing = isMissing(keyA);
      const bMissing = isMissing(keyB);
      if (aMissing && !bMissing) return -1;
      if (!aMissing && bMissing) return 1;
      return keyA.localeCompare(keyB);
    });
  }, [editedEnv, isMissing]);

  const effectiveRequirements = useMemo(() => {
    const result: Record<string, EnvRequirement> = {};
    // if a requirement wasn't found or given, we'll fallback to kind: "optional" with no prefilled
    Object.keys(editedEnv).forEach((key) => {
      result[key] = requirements?.[key] ?? {
        kind: "optional",
      };
    });
    return result;
  }, [requirements, editedEnv]);

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

  const handleValueChange = (key: string, value: EnvValue) => {
    setEditedEnv((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (hasInvalidEntries) {
      toast({
        title: `Saving failed`,
        description: `All variables needs to be valid`,
        variant: "destructive",
      });
      return; // block saving
    }
    onSave(editedEnv);
  };

  return (
    <div className="bg-card border rounded-lg p-4 mb-4">
      <div className="text-sm font-semibold text-foreground mb-3">
        Environment Variables
      </div>
      <TooltipProvider>
        <div className="space-y-3">
          {sortedEnvEntries.map(([key, value]) => (
            <EnvVarRow
              key={key}
              envKey={key}
              value={value}
              requirement={effectiveRequirements[key]}
              isMissing={isMissing(key)}
              missingInfo={getMissingInfo(key)}
              onValueChange={handleValueChange}
              disabled={isSaving}
            />
          ))}
        </div>
      </TooltipProvider>
      <div className="mt-4 flex justify-end">
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
