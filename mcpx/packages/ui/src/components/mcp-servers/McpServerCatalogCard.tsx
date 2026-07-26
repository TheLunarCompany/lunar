import { Check } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { McpCard } from "@/components/mcp-servers/McpCard";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type McpServerCatalogCardProps = {
  server: CatalogMCPServerConfigByNameItem;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  selected?: boolean;
  className?: string;
  checkboxDisabled?: boolean;
  isAdding?: boolean;
};

export function McpServerCatalogCard({
  server,
  checked,
  onCheckedChange,
  selected = false,
  className = "",
  checkboxDisabled = false,
  isAdding = false,
}: McpServerCatalogCardProps) {
  const isInstalled = checkboxDisabled;
  const showCheckbox = onCheckedChange != null && !isInstalled;
  const isSelected =
    isInstalled || (showCheckbox && (checked ?? false)) || selected;
  const interactive = showCheckbox && !isAdding;

  const toggleSelection = (): void => {
    if (!interactive) return;
    onCheckedChange?.(!(checked ?? false));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSelection();
    }
  };

  const action = isAdding ? (
    <Spinner
      aria-label={`Adding ${server.displayName || server.name}`}
      className="text-primary"
    />
  ) : isInstalled ? (
    <div className="inline-flex items-center gap-1 rounded-md bg-[#7D7B98] px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
      <Check className="size-3.5" />
      Installed
    </div>
  ) : showCheckbox ? (
    <div onClick={(event) => event.stopPropagation()}>
      <Checkbox
        checked={checked ?? false}
        onCheckedChange={(nextChecked) =>
          onCheckedChange?.(nextChecked === true)
        }
        aria-label={`Select ${server.displayName || server.name}`}
      />
    </div>
  ) : null;

  return (
    <McpCard
      server={server}
      action={action}
      selected={isSelected}
      className={cn(interactive && "cursor-pointer", className)}
      onClick={toggleSelection}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      aria-pressed={interactive ? isSelected : undefined}
      aria-disabled={isInstalled || isAdding ? true : undefined}
    />
  );
}
