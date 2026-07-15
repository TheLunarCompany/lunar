import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown } from "lucide-react";

export type SortOption<TValue extends string = string> = {
  label: string;
  value: TValue;
};

type SortProps<TValue extends string> = {
  title: string;
  options: Array<SortOption<TValue>>;
  selected: TValue;
  onChange: (value: TValue) => void;
};

export function Sort<TValue extends string>({
  title,
  options,
  selected,
  onChange,
}: SortProps<TValue>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className:
            "cursor-pointer aria-expanded:!bg-transparent aria-expanded:!text-inherit focus:!bg-transparent focus-visible:!border-transparent focus-visible:!ring-0 focus-visible:!ring-transparent",
        })}
      >
        <ArrowUpDown className="mr-2 size-4" />
        {title}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48 p-2">
        <DropdownMenuGroup>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={option.value === selected}
              className="rounded-sm px-3 py-2 text-sm hover:bg-gray-50 focus:!bg-transparent focus:!text-inherit focus-visible:!border-transparent focus-visible:!ring-0 focus-visible:!ring-transparent data-[highlighted]:!bg-transparent data-[highlighted]:!text-inherit"
              onCheckedChange={() => onChange(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
