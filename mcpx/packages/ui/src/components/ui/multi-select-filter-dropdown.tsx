import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

export type MultiSelectFilterDropdownProps<TOption> = {
  options: TOption[];
  getOptionValue: (option: TOption) => string;
  renderOption: (option: TOption) => React.ReactNode;
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
  /** Label of the leading item that clears the selection. */
  allLabel: React.ReactNode;
  /** Content rendered inside the trigger button. */
  triggerContent: React.ReactNode;
  triggerClassName?: string;
  /** Accessible name for the trigger, when the content isn't descriptive. */
  triggerLabel?: string;
  /** Enables a search input for filtering options within the open menu. */
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Keep the menu open while toggling items (default: true). */
  keepOpenOnSelect?: boolean;
  align?: React.ComponentProps<typeof DropdownMenuContent>["align"];
  contentClassName?: string;
};

/**
 * A checkbox dropdown for filtering by a set of options. An empty selection
 * means "all", surfaced as a leading item that clears the current selection.
 * The emitted array preserves the order of `options`.
 */
export function MultiSelectFilterDropdown<TOption>({
  options,
  getOptionValue,
  renderOption,
  selectedValues,
  onSelectedValuesChange,
  allLabel,
  triggerContent,
  triggerClassName,
  triggerLabel,
  searchPlaceholder,
  disabled = false,
  keepOpenOnSelect = true,
  align = "start",
  contentClassName,
}: MultiSelectFilterDropdownProps<TOption>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const selectedValueSet = React.useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  );
  const isAll = selectedValues.length === 0;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleOptions = normalizedSearchQuery
    ? options.filter((option) =>
        getOptionValue(option).toLowerCase().includes(normalizedSearchQuery),
      )
    : options;

  function toggleValue(value: string, checked: boolean) {
    const nextSelection = new Set(selectedValueSet);
    if (checked) {
      nextSelection.add(value);
    } else {
      nextSelection.delete(value);
    }

    onSelectedValuesChange(
      options.map(getOptionValue).filter((value) => nextSelection.has(value)),
    );
  }

  const handleSelect = keepOpenOnSelect
    ? (event: Event) => event.preventDefault()
    : undefined;

  function handleOpenChange(nextIsOpen: boolean) {
    setIsOpen(nextIsOpen);
    if (!nextIsOpen) setSearchQuery("");
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {triggerContent}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn("max-h-80 min-w-56 p-1", contentClassName)}
      >
        {searchPlaceholder ? (
          <SearchInput
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            wrapperClassName="mb-1 px-1 mt-1"
            className="h-8 rounded"
          />
        ) : null}
        <DropdownMenuCheckboxItem
          checked={isAll}
          onCheckedChange={() => onSelectedValuesChange([])}
          onSelect={handleSelect}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {visibleOptions.map((option) => {
            const value = getOptionValue(option);
            return (
              <DropdownMenuCheckboxItem
                key={value}
                checked={selectedValueSet.has(value)}
                onCheckedChange={(checked) =>
                  toggleValue(value, checked === true)
                }
                onSelect={handleSelect}
              >
                {renderOption(option)}
              </DropdownMenuCheckboxItem>
            );
          })}
          {visibleOptions.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
