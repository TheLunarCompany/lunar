import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EnvValue, MissingEnvVar } from "@/types";
import { useState, useMemo, useCallback } from "react";
import { EnvVarRow } from "./EnvVarRow";
import { EnvVarsEditorProps, isValidEnvValue } from "./types";

export const EnvVarsEditor = ({
  env,
  missingEnvVars = [],
  onSave,
  isSaving,
}: EnvVarsEditorProps) => {
  const [editedEnv, setEditedEnv] = useState<Record<string, EnvValue>>(() => ({
    ...env,
  }));

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

  const hasInvalidEntries = useMemo(
    () => Object.values(editedEnv).some((value) => !isValidEnvValue(value)),
    [editedEnv],
  );

  const handleValueChange = (key: string, value: EnvValue) => {
    setEditedEnv((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
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
          disabled={isSaving || hasInvalidEntries}
        >
          {isSaving ? "Saving..." : "Save & Connect"}
        </Button>
      </div>
    </div>
  );
};
