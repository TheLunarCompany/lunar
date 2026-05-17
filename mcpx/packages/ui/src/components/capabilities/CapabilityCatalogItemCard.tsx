import CustomBadge from "@/components/CustomBadge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Check,
  Eye,
  MoreVertical,
  Settings,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import CustomCapabilityBadgeSvg from "./icons/custom-capability-badge.svg?react";
import type { CapabilityItem } from "./types";

type CapabilityCatalogItemCardProps = {
  item: CapabilityItem;
  isSelectionMode?: boolean;
  isAddCustomToolMode?: boolean;
  isSelected?: boolean;
  selectionLocked?: boolean;
  onToggleSelection?: () => void;
  onShowDetails?: (item: CapabilityItem) => void;
  onCustomizeItem?: (item: CapabilityItem) => void;
  onEditItem?: (item: CapabilityItem) => void;
  onDeleteItem?: (item: CapabilityItem) => void;
};

function AnnotationBadges({ item }: { item: CapabilityItem }) {
  if (!item.annotations) {
    return null;
  }

  return (
    <div className="mb-1 flex flex-wrap gap-1">
      {item.annotations.readOnlyHint && (
        <Badge variant="success" size="sm">
          Read-only
        </Badge>
      )}
      {item.annotations.destructiveHint && (
        <Badge variant="danger" size="sm">
          Destructive
        </Badge>
      )}
      {!item.annotations.readOnlyHint && !item.annotations.destructiveHint && (
        <Badge variant="warning" size="sm">
          Write
        </Badge>
      )}
    </div>
  );
}

export function CapabilityCatalogItemCard({
  item,
  isSelectionMode = false,
  isAddCustomToolMode = false,
  isSelected = false,
  selectionLocked = false,
  onToggleSelection,
  onShowDetails,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
}: CapabilityCatalogItemCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isOriginalTool = !item.isCustom;
  const isSelectable =
    isSelectionMode &&
    (!isAddCustomToolMode || isOriginalTool) &&
    (!selectionLocked || isSelected);

  const handleCardClick = () => {
    if (isSelectable) {
      onToggleSelection?.();
      return;
    }

    if (!selectionLocked) {
      onShowDetails?.(item);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[120px] min-w-0 flex-col overflow-hidden rounded-lg border-2 border-[var(--colors-gray-200)] bg-white p-3 transition-all hover:border-primary hover:shadow-md hover:shadow-primary/30",
        isSelectionMode && isSelected
          ? "border-primary shadow-md shadow-primary/30"
          : "",
        selectionLocked && !isSelected ? "opacity-60" : "",
      )}
      data-capability-item-name={item.name}
      role={isSelectionMode ? "checkbox" : undefined}
      aria-label={isSelectionMode ? item.name : undefined}
      aria-checked={isSelectionMode ? isSelected : undefined}
      tabIndex={isSelectable ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (!isSelectable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleSelection?.();
        }
      }}
      style={{
        cursor: isSelectable
          ? "pointer"
          : selectionLocked
            ? "not-allowed"
            : onShowDetails
              ? "pointer"
              : "default",
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {isSelectionMode && (
          <div className="shrink-0 pt-0.5" aria-hidden="true">
            {isSelected ? (
              <span className="grid size-4 place-items-center rounded-sm border border-primary bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            ) : (
              <Square className="size-4 text-[var(--colors-gray-500)]" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3
            className="mb-1 min-h-5 truncate text-sm font-medium text-[var(--colors-gray-900)]"
            title={item.name}
          >
            {item.name}
          </h3>
          <AnnotationBadges item={item} />
          <p
            className="line-clamp-2 h-10 text-xs leading-relaxed text-[var(--colors-gray-600)]"
            title={item.description || "No description available"}
          >
            {item.description || "No description available"}
          </p>
          {item.isCustom && (
            <div className="mt-2 flex">
              <CustomBadge
                color="blue"
                rounded="lg"
                size="xs"
                label={<span>CUSTOM</span>}
                icon={
                  <CustomCapabilityBadgeSvg
                    aria-label="Custom capability icon"
                    className="size-4"
                    style={{ color: "#4F33CC" }}
                  />
                }
              />
            </div>
          )}
        </div>

        {!isSelectionMode && (
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger
              type="button"
              className={buttonVariants({
                variant: "ghost",
                size: "icon-sm",
              })}
              aria-label={`Open ${item.name} menu`}
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen(true);
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => onShowDetails?.(item)}>
                <Eye className="size-4" />
                Details
              </DropdownMenuItem>
              {item.isCustom ? (
                <DropdownMenuItem onClick={() => onEditItem?.(item)}>
                  <Settings className="size-4" />
                  Edit
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onCustomizeItem?.(item)}>
                  <Settings className="size-4" />
                  Customize
                </DropdownMenuItem>
              )}
              {item.isCustom && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeleteItem?.(item)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
