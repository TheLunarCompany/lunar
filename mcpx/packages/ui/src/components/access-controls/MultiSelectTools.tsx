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
import { Plus } from "lucide-react";

export const MultiSelectTools = ({
  disabled = false,
  onCreateNew,
  onSelectionChange,
  options,
  placeholder,
  selected,
  title,
}: {
  disabled?: boolean;
  onCreateNew: () => void;
  onSelectionChange: (value: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
  selected: string[];
  title: string;
}) => {
  const selectedCount = selected?.length || 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          className="w-full justify-start font-normal"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedCount > 0
              ? `${selectedCount} selected`
              : (placeholder ?? `Select ${title}...`)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={`Search ${title}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={onCreateNew}
                className="text-[var(--color-fg-success)] cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Tool Group
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => onSelectionChange(option.id)}
                >
                  <Checkbox
                    className="mr-2"
                    checked={selected.includes(option.id)}
                  />
                  <span>{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
