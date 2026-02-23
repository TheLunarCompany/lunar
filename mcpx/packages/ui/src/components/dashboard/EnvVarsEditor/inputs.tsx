import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FromEnvInputProps, LiteralInputProps } from "./types";
import { RotateCcw } from "lucide-react";

export const FixedInput = ({ value }: { value: string }) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Input
        value={value}
        disabled={true}
        readOnly={true}
        className="h-8 min-w-0 flex-1 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
      />
      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
        (fixed)
      </span>
    </div>
  );
};

export const FromEnvInput = ({
  value,
  onChange,
  isMissing,
  disabled,
  isRequired,
  hasPrefilled,
  isModified,
  onReset,
}: FromEnvInputProps) => (
  <div className="flex items-center gap-2 min-w-0">
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="ENV_VAR_NAME"
      className="h-8 min-w-0 flex-1 text-sm font-mono"
      disabled={disabled}
    />
    {hasPrefilled && isModified && onReset && (
      <button
        onClick={onReset}
        className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0"
        title="Reset to prefilled value"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    )}

    {isMissing && (
      <span className="text-xs text-red-500 whitespace-nowrap flex-shrink-0">
        (not set on server)
      </span>
    )}
    {isRequired && (
      <span className="text-red-500 text-xs flex-shrink-0">*</span>
    )}
  </div>
);

export const LiteralInput = ({
  value,
  onChange,
  onLeaveEmpty,
  isNull,
  disabled,
  envKey,
  isRequired,
  hasPrefilled,
  isModified,
  onReset,
}: LiteralInputProps) => (
  <div className="flex items-center gap-2 min-w-0">
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter value..."
      className="h-8 min-w-0 flex-1 text-sm"
      disabled={disabled || isNull}
    />
    {hasPrefilled && isModified && onReset && (
      <button
        onClick={onReset}
        className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0"
        title="Reset to prefilled value"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    )}
    <div className="flex items-center gap-1 flex-shrink-0">
      {!isRequired && (
        <>
          <Checkbox
            id={`leave-empty-${envKey}`}
            checked={isNull}
            onCheckedChange={(checked) => onLeaveEmpty(checked === true)}
            className="h-4 w-4"
          />
          <label
            htmlFor={`leave-empty-${envKey}`}
            className="text-xs text-gray-500 cursor-pointer"
          >
            empty
          </label>
        </>
      )}

      {isRequired && (
        <span className="text-red-500 text-sm flex-shrink-0">*</span>
      )}
    </div>
  </div>
);
