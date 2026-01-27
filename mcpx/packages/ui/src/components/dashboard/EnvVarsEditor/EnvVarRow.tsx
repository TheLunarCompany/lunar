import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X } from "lucide-react";
import {
  EnvVarRowProps,
  EnvVarMode,
  isFromEnv,
  isNull,
  isLiteral,
  getMode,
} from "./types";

export const EnvVarRow = ({
  envKey,
  value,
  isMissing,
  missingInfo,
  onValueChange,
  disabled,
}: EnvVarRowProps) => {
  const mode = getMode(value);
  const isNullValue = isNull(value);

  const handleModeChange = (newMode: EnvVarMode) => {
    if (newMode === "fromEnv") {
      // Switch to fromEnv mode with empty env var name
      onValueChange(envKey, { fromEnv: "" });
    } else {
      // Switch to literal mode with empty string
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

  return (
    <div className="flex items-center gap-3 p-2 rounded border border-gray-200 bg-white">
      {/* Status indicator */}
      <div className="flex-shrink-0">
        {isMissing ? (
          <X className="w-4 h-4 text-red-500" />
        ) : (
          <Check className="w-4 h-4 text-green-500" />
        )}
      </div>

      {/* Key name */}
      <div className="w-32 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700">{envKey}</span>
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

      {/* Value editor based on mode */}
      <div className="flex-1">
        {mode === "fromEnv" ? (
          <FromEnvInput
            fromEnvName={isFromEnv(value) ? value.fromEnv : ""}
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
          />
        )}
      </div>
    </div>
  );
};

// Sub-components

const FromEnvInput = ({
  fromEnvName,
  onChange,
  isMissing,
  disabled,
}: {
  fromEnvName: string;
  onChange: (envVarName: string) => void;
  isMissing: boolean;
  disabled: boolean;
}) => (
  <div className="flex items-center gap-2">
    <Input
      value={fromEnvName}
      onChange={(e) => onChange(e.target.value)}
      placeholder="ENV_VAR_NAME"
      className="h-8 text-sm font-mono"
      disabled={disabled}
    />
    {isMissing && (
      <span className="text-xs text-red-500 whitespace-nowrap">
        (not set on server)
      </span>
    )}
  </div>
);

const LiteralInput = ({
  value,
  onChange,
  onLeaveEmpty,
  isNull,
  disabled,
  envKey,
}: {
  value: string;
  onChange: (value: string) => void;
  onLeaveEmpty: (checked: boolean) => void;
  isNull: boolean;
  disabled: boolean;
  envKey: string;
}) => (
  <div className="flex items-center gap-2">
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter value..."
      className="h-8 text-sm"
      disabled={disabled || isNull}
    />
    <div className="flex items-center gap-1">
      <Checkbox
        id={`leave-empty-${envKey}`}
        checked={isNull}
        onCheckedChange={(checked) => onLeaveEmpty(checked === true)}
        disabled={disabled}
        className="h-4 w-4"
      />
      <label
        htmlFor={`leave-empty-${envKey}`}
        className="text-xs text-gray-500 cursor-pointer"
      >
        empty
      </label>
    </div>
  </div>
);
