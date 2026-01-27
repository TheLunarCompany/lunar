import { Button } from "@/components/ui/button";
import { EnvValue, MissingEnvVar } from "@/types";
import { useState, useMemo, useCallback } from "react";
import { EnvVarRow } from "./EnvVarRow";
import { EnvVarsEditorProps, isFromEnv, isLiteral } from "./types";

const isValidEnvValue = (value: EnvValue): boolean => {
  if (value === null) return true; // intentionally empty
  if (isLiteral(value)) return value.trim() !== ""; // non-empty string
  if (isFromEnv(value)) return value.fromEnv.trim() !== ""; // non-empty env var name
  return false;
};

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
