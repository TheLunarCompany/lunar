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
import { Plus } from "lucide-react";
import { useState } from "react";

export const ToolSelector = ({
  toolsList,
  onSelectionChange,
}: {
  toolsList: Array<{ name: string; serviceName: string }>;
  onSelectionChange: (value: string) => void;
}) => {
  const groupedTools = toolsList.reduce(
    (acc, tool) => {
      const groupKey = tool.serviceName;
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(tool);
      return acc;
    },
    {} as Record<string, Array<{ name: string; serviceName: string }>>,
  );
  const [search, setSearch] = useState("");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="px-2">
          <Plus className="w-full justify-start font-normal" />
          Add Custom Tool
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[calc(var(--radix-popover-trigger-width)*2)]"
        align="end"
      >
        <Command>
          <CommandInput
            placeholder="Search tools..."
            onValueChange={(value) => {
              setSearch(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim()) {
                onSelectionChange(search);
                setSearch("");
              }
            }}
            value={search}
          />
          <CommandList>
            <CommandEmpty className="overflow-hidden p-2 m-0.5 text-sm text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
              No results found.
            </CommandEmpty>
            {Object.entries(groupedTools).map(([group, tools]) => (
              <CommandGroup
                key={group}
                heading={group}
                className="overflow-hidden p-2 m-0.5 text-sm text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {tools.map((tool) => (
                  <CommandItem
                    key={tool.name}
                    onSelect={() => onSelectionChange(tool.name)}
                    className="cursor-pointer overflow-ellipsis whitespace-nowrap overflow-hidden block"
                  >
                    {tool.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {/* <CommandGroup>
              {options.map(({ label, value, disabled }, index) => (
                <CommandItem
                  className="cursor-pointer overflow-ellipsis whitespace-nowrap overflow-hidden block"
                  key={`tool_option_${value}_${index}`}
                  onSelect={() => onSelectionChange(value)}
                  disabled={disabled}
                >
                  {label}
                </CommandItem>
              ))}
            </CommandGroup> */}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
