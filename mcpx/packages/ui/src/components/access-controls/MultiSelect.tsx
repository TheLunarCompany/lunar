import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useState } from "react";

export const MultiSelect = ({
  disabled = false,
  getTriggerText = (selected) =>
    selected.length > 0 ? `${selected.length} selected` : `Select...`,
  onCreateNew,
  onSelectionChange,
  options,
  searchPlaceholder,
  selected,
}: {
  disabled?: boolean;
  getTriggerText?: (selected: string[]) => string;
  onCreateNew?: (value: string) => void;
  onSelectionChange: (value: string) => void;
  options: { label: string; value: string; disabled?: boolean }[];
  searchPlaceholder?: string;
  selected: string[];
}) => {
  const [search, setSearch] = useState("");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          className="w-full justify-start font-normal"
          disabled={disabled}
        >
          <span className="truncate">{getTriggerText(selected)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={(value) => {
              setSearch(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search && onCreateNew) {
                onCreateNew(search);
                onSelectionChange(search);
                setSearch("");
              }
            }}
            value={search}
          />
          <CommandList>
            <CommandEmpty className="overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
              {search && onCreateNew ? (
                <span
                  className="relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none bg-component-secondary text-secondary-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
                  key={search}
                  onClick={() => {
                    onCreateNew(search);
                    onSelectionChange(search);
                    setSearch("");
                  }}
                  data-selected
                >
                  <Checkbox className="mr-2" />
                  <span>{search}</span>
                </span>
              ) : (
                "No results found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map(({ label, value, disabled }, index) => (
                <CommandItem
                  key={`tool_option_${value}_${index}`}
                  onSelect={() => onSelectionChange(value)}
                  disabled={disabled}
                >
                  <Checkbox
                    className="mr-2"
                    checked={selected.includes(value)}
                  />
                  <span>{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
