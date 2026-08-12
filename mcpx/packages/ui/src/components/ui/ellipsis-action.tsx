import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as React from "react";

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
        <div className="cursor-pointer text-[var(--colors-gray-600)]">
          <MoreVertical
            style={{ color: "var(--colors-gray-600)" }}
            className="w-4 h-4 text-[var(--colors-gray-600)]"
          />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {safeItems.map((item, idx) => (
          <DropdownMenuItem
            className="group gap-2 text-[var(--colors-gray-700)] hover:bg-[var(--colors-gray-50)] hover:text-[var(--colors-gray-950)] focus:bg-[var(--colors-gray-50)] focus:text-[var(--colors-gray-950)] data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:text-destructive [&_svg]:text-current"
            key={idx}
            variant={
              item.label.toLowerCase() === "delete" ? "destructive" : "default"
            }
            onClick={(e) => {
              e.stopPropagation();
              item.callback();
              setOpen(false);
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
