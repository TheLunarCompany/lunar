import { MoreHorizontal, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import * as React from "react";
import { Button } from "./button";

type ActionItem = {
  label: string;
  callback: () => void;
  icon?: React.ReactNode;
};

export function EllipsisActions({ items }: { items: ActionItem[] }) {
  const safeItems = items.filter(Boolean);
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div  className="cursor-pointer text-[var(--colors-gray-600)" >
          <MoreVertical style={{ color: "var(--colors-gray-600)" }} className="w-5 h-5 color-[var(--colors-gray-600)" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end"   onClick={(e) => e.stopPropagation()}
  onPointerDown={(e) => e.stopPropagation()}>
        {safeItems.map((item, idx) => (
          <DropdownMenuItem
            className="group gap-2 text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive)] focus:bg-[var(--color-bg-interactive-hover)] focus:text-[var(--color-fg-interactive)] "
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              item.callback();
              setOpen(false); // Close dropdown immediately
            }}
            onSelect={(e) => {
              e.preventDefault();
            }}

          >
             {item.icon}

            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}