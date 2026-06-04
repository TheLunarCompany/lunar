import CustomBadge from "@/components/CustomBadge";
import { cn } from "@/lib/utils";
import { Check, Eye, Settings, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import BracketsCurlyIcon from "./icons/brackets-curly.svg?react";
import ChatsIcon from "./icons/chats.svg?react";
import CustomCapabilityBadgeSvg from "./icons/custom-capability-badge.svg?react";
import PromptIcon from "./icons/prompt.svg?react";
import VinylRecordIcon from "./icons/vinyl-record.svg?react";
import { CapabilityItemCard } from "./CapabilityItemCard";
import type { CapabilityItem } from "./types";

type CapabilityPromptCardMetricCounts = {
  inputFields?: number;
  messages?: number;
  resources?: number;
};

type CapabilityPromptCardProps = {
  item: CapabilityItem;
  className?: string;
  metricCounts?: CapabilityPromptCardMetricCounts;
  isSelectionMode?: boolean;
  isAddCustomToolMode?: boolean;
  isSelected?: boolean;
  selectionLocked?: boolean;
  onToggleSelection?: () => void;
  onShowDetails?: (item: CapabilityItem) => void;
  onCustomizeItem?: (item: CapabilityItem) => void;
  onEditItem?: (item: CapabilityItem) => void;
  onDeleteItem?: (item: CapabilityItem) => void;
  showActions?: boolean;
};

function getInputFieldCount(item: CapabilityItem) {
  return Object.keys(item.inputSchema?.properties ?? {}).length;
}

function CapabilitySelectionIndicator({ isSelected }: { isSelected: boolean }) {
  return (
    <span className="absolute right-2 top-2" aria-hidden="true">
      {isSelected ? (
        <span className="grid size-4 place-items-center rounded-sm border border-primary bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      ) : (
        <Square className="size-4 text-[var(--colors-gray-500)]" />
      )}
    </span>
  );
}

export function CapabilityPromptCard({
  item,
  className,
  metricCounts,
  isSelectionMode = false,
  isAddCustomToolMode = false,
  isSelected = false,
  selectionLocked = false,
  onToggleSelection,
  onShowDetails,
  onEditItem,
  onDeleteItem,
  showActions = true,
}: CapabilityPromptCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isOriginalTool = !item.isCustom;
  const isSelectable =
    isSelectionMode &&
    (!isAddCustomToolMode || isOriginalTool) &&
    (!selectionLocked || isSelected);
  const opensDetails = !isSelectionMode && !selectionLocked && !!onShowDetails;
  const description = item.description || "No description available";
  const inputFieldsCount =
    metricCounts?.inputFields ?? getInputFieldCount(item);
  const messagesCount = metricCounts?.messages ?? item.messages?.length ?? 0;
  const resourcesCount = metricCounts?.resources ?? 0;

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
    <CapabilityItemCard
      className={cn(
        "transition-all",
        isSelectable || opensDetails
          ? "cursor-pointer hover:border-primary hover:shadow-md hover:shadow-primary/30"
          : "",
        isSelectionMode && isSelected
          ? "border-primary shadow-md shadow-primary/30"
          : "",
        selectionLocked && !isSelected ? "cursor-not-allowed opacity-60" : "",
        className,
      )}
      data-capability-item-name={item.name}
      role={isSelectionMode ? "checkbox" : opensDetails ? "button" : undefined}
      aria-label={isSelectionMode || opensDetails ? item.name : undefined}
      aria-checked={isSelectionMode ? isSelected : undefined}
      tabIndex={isSelectable || opensDetails ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (isSelectable) {
            onToggleSelection?.();
          } else if (opensDetails) {
            onShowDetails?.(item);
          }
        }
      }}
    >
      <CapabilityItemCard.Header className={isSelectionMode ? "pr-8" : ""}>
        {isSelectionMode && (
          <CapabilitySelectionIndicator isSelected={isSelected} />
        )}
        <CapabilityItemCard.TitleBadge variant="success" icon={<PromptIcon />}>
          {item.name}
        </CapabilityItemCard.TitleBadge>
        {!isSelectionMode && showActions && (
          <CapabilityItemCard.Menu
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <CapabilityItemCard.MenuButton
              aria-label={`Open ${item.name} menu`}
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen(true);
              }}
              onKeyDown={(event) => event.stopPropagation()}
            />
            <CapabilityItemCard.MenuContent
              onClick={(event) => event.stopPropagation()}
            >
              <CapabilityItemCard.MenuItem
                onClick={() => onShowDetails?.(item)}
              >
                <Eye className="size-4" />
                Details
              </CapabilityItemCard.MenuItem>
              {item.isCustom && (
                <CapabilityItemCard.MenuItem onClick={() => onEditItem?.(item)}>
                  <Settings className="size-4" />
                  Edit
                </CapabilityItemCard.MenuItem>
              )}
              {item.isCustom && (
                <CapabilityItemCard.MenuItem
                  variant="destructive"
                  onClick={() => onDeleteItem?.(item)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </CapabilityItemCard.MenuItem>
              )}
            </CapabilityItemCard.MenuContent>
          </CapabilityItemCard.Menu>
        )}
      </CapabilityItemCard.Header>
      <CapabilityItemCard.Description title={description}>
        {description}
      </CapabilityItemCard.Description>
      {item.isCustom && (
        <div className="flex justify-start">
          <CustomBadge
            color="blue"
            rounded="lg"
            size="xs"
            label={<span>CUSTOM</span>}
            icon={
              <CustomCapabilityBadgeSvg
                aria-label="Custom capability icon"
                className="size-4 text-primary"
              />
            }
          />
        </div>
      )}
      <CapabilityItemCard.Divider />
      <CapabilityItemCard.Metrics>
        <CapabilityItemCard.Metric
          icon={<BracketsCurlyIcon />}
          value={inputFieldsCount}
          label="Input fields"
        />
        <CapabilityItemCard.Metric
          icon={<ChatsIcon />}
          value={messagesCount}
          label="Messages"
        />
        <CapabilityItemCard.Metric
          icon={<VinylRecordIcon className="rotate-90" />}
          value={resourcesCount}
          label="Resources"
        />
      </CapabilityItemCard.Metrics>
    </CapabilityItemCard>
  );
}
