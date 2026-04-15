import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EditableEnvVarInputProps,
  LiteralInputProps,
  FromSecretInputProps,
} from "@mcpx/toolkit-ui/src/utils/env-vars-utils";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const inputClassName =
  "h-10 w-full rounded-md border border-[#D8DCED] px-3 py-2 text-sm min-w-0";

export const FixedInput = ({ value }: { value: string }) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Input
        value={value}
        disabled
        readOnly
        className={`${inputClassName} flex-1 bg-gray-100 text-gray-600 cursor-not-allowed`}
      />
      <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
        (fixed)
      </span>
    </div>
  );
};

export const FromEnvInput = ({
  value,
  onChange,
  disabled,
}: EditableEnvVarInputProps) => (
  <div className="flex items-center gap-2 min-w-0 flex-1">
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="ENV_VAR_NAME"
      className={`${inputClassName} flex-1 font-mono`}
      disabled={disabled}
    />
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
}: LiteralInputProps) => {
  const [valueVisible, setValueVisible] = useState(true);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 min-w-0 flex items-center">
        <Input
          type={valueVisible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter value..."
          className={`${inputClassName} flex-1 pr-10`}
          disabled={disabled || isNull}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 bottom-0 h-10 w-10 shrink-0 rounded-l-none"
          onClick={() => setValueVisible((v) => !v)}
          aria-label={valueVisible ? "Hide value" : "Show value"}
        >
          {valueVisible ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-1 shrink-0">
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
              className="text-xs text-gray-500 cursor-pointer whitespace-nowrap"
            >
              empty
            </label>
          </>
        )}
      </div>
    </div>
  );
};

export const FromSecretInput = ({
  value,
  onChange,
  disabled,
  secrets,
  isLoading,
}: FromSecretInputProps) => (
  <div className="flex items-center gap-2 min-w-0 flex-1">
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={`${inputClassName} flex-1 bg-white`}
        disabled={disabled || isLoading}
      >
        <SelectValue
          placeholder={isLoading ? "Loading secrets..." : "Select a secret"}
        />
      </SelectTrigger>
      <SelectContent className="w-(--radix-select-trigger-width)">
        {secrets.map((secret) => (
          <SelectItem key={secret} value={secret} title={secret}>
            <span className="block truncate">{secret}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
