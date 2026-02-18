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
import { Check, X } from "lucide-react";
import {
  EnvVarRowProps,
  EnvVarMode,
  isFromEnv,
  isNull,
  isLiteral,
  getMode,
} from "./types";
import { FromEnvInput, LiteralInput } from "./inputs";

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
        {mode === "fromEnv" ? (
          <FromEnvInput
            value={isFromEnv(value) ? value.fromEnv : ""}
            onChange={handleFromEnvChange}
            isMissing={isMissing && missingInfo?.type === "fromEnv"}
            disabled={disabled}
            isRequired={false} // TODO(MCP-733): fix when the requirement data will be available
          />
        ) : (
          <LiteralInput
            value={isLiteral(value) ? value : ""}
            onChange={handleLiteralChange}
            onLeaveEmpty={handleLeaveEmpty}
            isNull={isNullValue}
            disabled={disabled}
            envKey={envKey}
            isRequired={false} // TODO(MCP-733): fix when the requirement data will be available
          />
        )}
      </div>
    </div>
  );
};
