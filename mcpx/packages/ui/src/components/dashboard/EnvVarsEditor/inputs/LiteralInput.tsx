import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { LiteralInputProps } from "@mcpx/toolkit-ui/src/utils/env-vars-utils";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export const LiteralInput = ({
  value,
  onChange,
  onLeaveEmpty,
  isNull,
  disabled,
  envKey,
  isRequired,
  isSecret,
}: LiteralInputProps) => {
  const [valueVisible, setValueVisible] = useState(!isSecret);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 min-w-0 flex items-center">
        <Input
          type={valueVisible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter value..."
          className="h-10 w-full min-w-0 rounded-md border-input bg-background px-3 py-2 text-sm flex-1 pr-10"
          disabled={disabled} // disabled only during saving
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
              className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
            >
              empty
            </label>
          </>
        )}
      </div>
    </div>
  );
};
