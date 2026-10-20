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
        <div className="cursor-pointer text-mcpx-text-secondary">
          <MoreVertical className="w-4 h-4 text-mcpx-text-secondary" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {safeItems.map((item, idx) => (
          <DropdownMenuItem
            className="group gap-2 text-mcpx-text hover:bg-mcpx-surface-hover hover:text-mcpx-text focus:bg-mcpx-surface-hover focus:text-mcpx-text data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:text-destructive [&_svg]:text-current"
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
