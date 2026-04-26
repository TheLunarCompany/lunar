import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  EditableEnvVarInputProps,
  LiteralInputProps,
  FromSecretInputProps,
} from "@mcpx/toolkit-ui/src/utils/env-vars-utils";
import { Check, ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border-input bg-background px-3 py-2 text-sm";

export const FixedInput = ({ value }: { value: string }) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Input
        value={value}
        disabled
        readOnly
        className={`${inputClassName} flex-1 bg-muted/40 text-muted-foreground cursor-not-allowed`}
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
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

export const FromSecretInput = ({
  value,
  onChange,
  disabled,
  secrets,
  isLoading,
}: FromSecretInputProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className={cn(
              inputClassName,
              "flex-1 flex items-center justify-between cursor-pointer",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {isLoading ? "Loading secrets..." : value || "Select a secret"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search secrets..." />
            <CommandList>
              <CommandEmpty>No secrets found.</CommandEmpty>
              <CommandGroup>
                {secrets.map((secret) => (
                  <CommandItem
                    key={secret}
                    value={secret}
                    onSelect={() => {
                      onChange(secret);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === secret ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{secret}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
