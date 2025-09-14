"use client";

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
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  autocompletePlaceholder?: string;
  autocompleteNoResultsText?: string;
  buttonLabel: string;
  buttonProps?: React.ComponentProps<typeof Button>;
  disableSearch?: boolean;
  multiple?: boolean;
  onChange: (values: string[]) => void;
  options: ComboboxOption[];
  values: string[];
}

export function Combobox({
  autocompletePlaceholder,
  autocompleteNoResultsText,
  buttonLabel,
  buttonProps = {},
  disableSearch = false,
  multiple = false,
  onChange,
  options,
  values,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          {...buttonProps}
          className={cn("w-full justify-between", buttonProps.className)}
        >
          {buttonLabel}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          {!disableSearch && (
            <CommandInput
              placeholder={autocompletePlaceholder || "Search..."}
              className="h-9"
            />
          )}
          <CommandList>
            {!disableSearch && (
              <CommandEmpty>
                {autocompleteNoResultsText || "No results found."}
              </CommandEmpty>
            )}
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={(currentValue) => {
                    const newValue = multiple
                      ? values.includes(currentValue)
                        ? values.filter((v: string) => v !== currentValue)
                        : [...values, currentValue]
                      : [currentValue];
                    setOpen(false);
                    onChange(newValue);
                  }}
                >
                  {o.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      values.includes(o.value) ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
