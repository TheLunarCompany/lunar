import CustomBadge from "@/components/CustomBadge";
import { cn } from "@/lib/utils";
import { Check, Coins, Eye, Settings, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import BracketsCurlyIcon from "./icons/brackets-curly.svg?react";
import CustomCapabilityBadgeSvg from "./icons/custom-capability-badge.svg?react";
import GitBranchIcon from "./icons/git-branch-01.svg?react";
import { CapabilityItemCard } from "./CapabilityItemCard";
import type { CapabilityItem } from "./types";

// Tools show input fields and, when present, an estimated token count.
// Messages/resources are prompt-only.
type CapabilityToolCardMetricCounts = {
  inputFields?: number;
  tokens?: number;
};

type CapabilityToolCardProps = {
  item: CapabilityItem;
  className?: string;
  metricCounts?: CapabilityToolCardMetricCounts;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onShowDetails?: (item: CapabilityItem) => void;
  onCustomizeItem?: (item: CapabilityItem) => void;
  onEditItem?: (item: CapabilityItem) => void;
  onDeleteItem?: (item: CapabilityItem) => void;
  showActions?: boolean;
};

function getAnnotationLabel(item: CapabilityItem) {
  if (!item.annotations) {
    return null;
  }

  if (item.annotations.readOnlyHint) {
    return "READ ONLY";
  }

  if (item.annotations.destructiveHint) {
    return "DESTRUCTIVE";
  }

  return "WRITE";
}

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

export function CapabilityToolCard({
  item,
  className,
  metricCounts,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onShowDetails,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
  showActions = true,
}: CapabilityToolCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSelectable = isSelectionMode;
  const description = item.description || "No description available";
  const annotationLabel = getAnnotationLabel(item);
  const inputFieldsCount =
    metricCounts?.inputFields ?? getInputFieldCount(item);
  const tokensCount = metricCounts?.tokens ?? item.estimatedTokens;

  const handleCardClick = () => {
    if (isSelectable) {
      onToggleSelection?.();
      return;
    }

    onShowDetails?.(item);
  };

  return (
    <CapabilityItemCard
      className={cn(
        "transition-all",
        isSelectable || onShowDetails
          ? "cursor-pointer hover:border-primary hover:shadow-md hover:shadow-primary/30"
          : "",
        isSelectionMode && isSelected
          ? "border-primary shadow-md shadow-primary/30"
          : "",
        className,
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
    >
      <CapabilityItemCard.Header className={isSelectionMode ? "pr-8" : ""}>
        {isSelectionMode && (
          <CapabilitySelectionIndicator isSelected={isSelected} />
        )}
        <CapabilityItemCard.TitleBadge
          icon={
            item.iconUrl ? (
              <img
                src={item.iconUrl}
                alt=""
                aria-hidden="true"
                className="size-4 object-contain"
              />
            ) : (
              <GitBranchIcon aria-label="Capability type icon" />
            )
          }
        >
          {item.name}
        </CapabilityItemCard.TitleBadge>
        {annotationLabel && (
          <CapabilityItemCard.StatusBadge>
            {annotationLabel}
          </CapabilityItemCard.StatusBadge>
        )}
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
              {item.isCustom ? (
                <CapabilityItemCard.MenuItem onClick={() => onEditItem?.(item)}>
                  <Settings className="size-4" />
                  Edit
                </CapabilityItemCard.MenuItem>
              ) : (
                <CapabilityItemCard.MenuItem
                  onClick={() => onCustomizeItem?.(item)}
                >
                  <Settings className="size-4" />
                  Customize
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
      <CapabilityItemCard.Divider className="mt-auto" />
      <CapabilityItemCard.Metrics>
        <CapabilityItemCard.Metric
          icon={<BracketsCurlyIcon />}
          value={inputFieldsCount}
          label="Input fields"
        />
        {tokensCount !== undefined && (
          <CapabilityItemCard.Metric
            icon={<Coins />}
            value={tokensCount}
            label="Estimated tokens"
          />
        )}
      </CapabilityItemCard.Metrics>
    </CapabilityItemCard>
  );
}
