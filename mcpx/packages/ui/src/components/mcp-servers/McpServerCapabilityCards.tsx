import CustomBadge from "@/components/CustomBadge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  TOOLTIP_HOVER_DELAY_MS,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Coins, Eye, MoreVertical, Settings, Trash2 } from "lucide-react";
import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import BracketsCurlyIcon from "@/components/capabilities/icons/brackets-curly.svg?react";
import ChatsIcon from "@/components/capabilities/icons/chats.svg?react";
import CustomCapabilityBadgeSvg from "@/components/capabilities/icons/custom-capability-badge.svg?react";
import GitBranchIcon from "@/components/capabilities/icons/git-branch-01.svg?react";
import PromptIcon from "@/components/capabilities/icons/prompt.svg?react";
import VinylRecordIcon from "@/components/capabilities/icons/vinyl-record.svg?react";
import type { CapabilityItem } from "@/components/capabilities/types";

const titleBadgeVariants = cva(
  "flex min-w-0 max-w-full items-center rounded font-medium leading-[1.34] tracking-[0] text-[var(--text-colours-color-text-primary)] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        interactive: "bg-[var(--colors-primary-100)]",
        success: "bg-[var(--colors-success-100)]",
      },
      size: {
        md: "h-7 gap-2 px-1.5 py-1 text-sm [&_svg]:size-4",
        sm: "h-5 gap-1 px-1 py-0.5 text-[11px] [&_svg]:size-3",
      },
    },
    defaultVariants: {
      variant: "interactive",
      size: "md",
    },
  },
);

type McpServerCapabilityCardProps = ComponentPropsWithoutRef<typeof Card>;

function McpServerCapabilityCardRoot({
  className,
  children,
  ...props
}: McpServerCapabilityCardProps) {
  return (
    <Card
      className={cn(
        "relative flex w-[376px] max-w-full flex-col gap-3 rounded-lg border border-[var(--structure-color-border-primary)] bg-[var(--colors-white)] p-3 text-[var(--text-colours-color-text-primary)] shadow-none ring-0",
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

function McpServerCapabilityCardHeader({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function McpServerCapabilityCardTitleBadge({
  className,
  children,
  icon,
  variant,
  size,
  ...props
}: ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof titleBadgeVariants> & {
    icon?: ReactNode;
  }) {
  return (
    <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(titleBadgeVariants({ variant, size }), className)}
            {...props}
          >
            {icon}
            <span className="min-w-0 truncate">{children}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="z-[9999] max-w-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function McpServerCapabilityCardStatusBadge({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Badge>) {
  return (
    <Badge
      variant="outline"
      size="sm"
      className={cn(
        "h-[15px] rounded border-[var(--text-colours-color-text-secondary)] px-1 py-0 text-[10px] font-medium leading-none text-[var(--text-colours-color-text-secondary)]",
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}

function McpServerCapabilityCardDescription({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
      <Tooltip>
        <TooltipTrigger asChild>
          <p
            className={cn(
              "line-clamp-2 text-[13px] font-normal leading-[1.34] tracking-[0] text-[var(--text-colours-color-text-secondary)]",
              className,
            )}
            {...props}
          >
            {children}
          </p>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="z-[9999] max-w-sm">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function McpServerCapabilityCardDivider({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Separator>) {
  return (
    <Separator
      className={cn("bg-[var(--structure-color-border-primary)]", className)}
      decorative
      {...props}
    />
  );
}

function McpServerCapabilityCardMetrics({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

function McpServerCapabilityCardMetric({
  className,
  icon,
  value,
  label,
  ...props
}: Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-label={`${label}: ${value}`}
            className={cn(
              "flex items-center gap-1 text-[11px] font-semibold leading-none text-[var(--text-colours-color-text-primary)]",
              className,
            )}
            {...props}
          >
            <span className="grid size-4 place-items-center text-[var(--text-colours-color-text-secondary)] [&_svg]:size-4">
              {icon}
            </span>
            <span>{value}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="z-[9999]">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function McpServerCapabilityCardMenu({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu>) {
  return <DropdownMenu {...props}>{children}</DropdownMenu>;
}

function McpServerCapabilityCardMenuButton({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      type="button"
      aria-label="Open capability item menu"
      className={buttonVariants({
        variant: "ghost",
        size: "icon-sm",
        className: cn(
          "absolute right-1 top-1 text-[var(--text-colours-color-text-secondary)] hover:bg-[var(--structure-color-bg-container-overlay)]",
          className,
        ),
      })}
      {...props}
    >
      <MoreVertical />
    </DropdownMenuTrigger>
  );
}

function McpServerCapabilityCardMenuContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align="end"
      className={cn("w-40", className)}
      {...props}
    >
      <DropdownMenuGroup>{children}</DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

function McpServerCapabilityCardMenuItem({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuItem>) {
  return <DropdownMenuItem {...props}>{children}</DropdownMenuItem>;
}

const McpServerCapabilityCard = Object.assign(McpServerCapabilityCardRoot, {
  Header: McpServerCapabilityCardHeader,
  TitleBadge: McpServerCapabilityCardTitleBadge,
  StatusBadge: McpServerCapabilityCardStatusBadge,
  Description: McpServerCapabilityCardDescription,
  Divider: McpServerCapabilityCardDivider,
  Metrics: McpServerCapabilityCardMetrics,
  Metric: McpServerCapabilityCardMetric,
  Menu: McpServerCapabilityCardMenu,
  MenuButton: McpServerCapabilityCardMenuButton,
  MenuContent: McpServerCapabilityCardMenuContent,
  MenuItem: McpServerCapabilityCardMenuItem,
});

function getAnnotationLabel(item: CapabilityItem) {
  if (item.annotations?.readOnlyHint) {
    return "READ ONLY";
  }

  if (item.annotations?.destructiveHint) {
    return "DESTRUCTIVE";
  }

  return "WRITE";
}

function getInputFieldCount(item: CapabilityItem) {
  return Object.keys(item.inputSchema?.properties ?? {}).length;
}

type McpServerToolCardProps = {
  item: CapabilityItem;
  className?: string;
  onShowDetails?: (item: CapabilityItem) => void;
  onCustomizeItem?: (item: CapabilityItem) => void;
  onEditItem?: (item: CapabilityItem) => void;
  onDeleteItem?: (item: CapabilityItem) => void;
  showActions?: boolean;
};

export function McpServerToolCard({
  item,
  className,
  onShowDetails,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
  showActions = true,
}: McpServerToolCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const description = item.description || "No description available";
  const annotationLabel = getAnnotationLabel(item);
  const inputFieldsCount = getInputFieldCount(item);
  const opensDetails = !!onShowDetails;

  return (
    <McpServerCapabilityCard
      className={cn(
        opensDetails
          ? "cursor-pointer transition-all hover:shadow-sm hover:shadow-primary/20"
          : "transition-all",
        className,
      )}
      data-capability-item-name={item.name}
      role={opensDetails ? "button" : undefined}
      aria-label={opensDetails ? item.name : undefined}
      tabIndex={opensDetails ? 0 : -1}
      onClick={() => onShowDetails?.(item)}
      onKeyDown={(event) => {
        if (!opensDetails) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onShowDetails?.(item);
        }
      }}
    >
      <McpServerCapabilityCard.Header>
        <McpServerCapabilityCard.TitleBadge
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
        </McpServerCapabilityCard.TitleBadge>
        {annotationLabel && (
          <McpServerCapabilityCard.StatusBadge>
            {annotationLabel}
          </McpServerCapabilityCard.StatusBadge>
        )}
        {showActions && (
          <McpServerCapabilityCard.Menu
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <McpServerCapabilityCard.MenuButton
              aria-label={`Open ${item.name} menu`}
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen(true);
              }}
              onKeyDown={(event) => event.stopPropagation()}
            />
            <McpServerCapabilityCard.MenuContent
              onClick={(event) => event.stopPropagation()}
            >
              <McpServerCapabilityCard.MenuItem
                onClick={() => onShowDetails?.(item)}
              >
                <Eye className="size-4" />
                Details
              </McpServerCapabilityCard.MenuItem>
              {item.isCustom ? (
                <McpServerCapabilityCard.MenuItem
                  onClick={() => onEditItem?.(item)}
                >
                  <Settings className="size-4" />
                  Edit
                </McpServerCapabilityCard.MenuItem>
              ) : (
                <McpServerCapabilityCard.MenuItem
                  onClick={() => onCustomizeItem?.(item)}
                >
                  <Settings className="size-4" />
                  Customize
                </McpServerCapabilityCard.MenuItem>
              )}
              {item.isCustom && (
                <McpServerCapabilityCard.MenuItem
                  variant="destructive"
                  onClick={() => onDeleteItem?.(item)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </McpServerCapabilityCard.MenuItem>
              )}
            </McpServerCapabilityCard.MenuContent>
          </McpServerCapabilityCard.Menu>
        )}
      </McpServerCapabilityCard.Header>
      <McpServerCapabilityCard.Description title={description}>
        {description}
      </McpServerCapabilityCard.Description>
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
      <McpServerCapabilityCard.Divider className="mt-auto" />
      <McpServerCapabilityCard.Metrics>
        <McpServerCapabilityCard.Metric
          icon={<BracketsCurlyIcon />}
          value={inputFieldsCount}
          label="Input fields"
        />
        {item.estimatedTokens !== undefined && (
          <McpServerCapabilityCard.Metric
            icon={<Coins />}
            value={item.estimatedTokens}
            label="Estimated tokens"
          />
        )}
      </McpServerCapabilityCard.Metrics>
    </McpServerCapabilityCard>
  );
}

type McpServerPromptCardProps = {
  item: CapabilityItem;
  className?: string;
  onShowDetails?: (item: CapabilityItem) => void;
  onEditItem?: (item: CapabilityItem) => void;
  onDeleteItem?: (item: CapabilityItem) => void;
  showActions?: boolean;
};

export function McpServerPromptCard({
  item,
  className,
  onShowDetails,
  onEditItem,
  onDeleteItem,
  showActions = true,
}: McpServerPromptCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const description = item.description || "No description available";
  const inputFieldsCount = getInputFieldCount(item);
  const messagesCount = item.messages?.length ?? 0;
  const opensDetails = !!onShowDetails;

  return (
    <McpServerCapabilityCard
      className={cn(
        opensDetails
          ? "cursor-pointer transition-all hover:shadow-sm hover:shadow-primary/20"
          : "transition-all",
        className,
      )}
      data-capability-item-name={item.name}
      role={opensDetails ? "button" : undefined}
      aria-label={opensDetails ? item.name : undefined}
      tabIndex={opensDetails ? 0 : -1}
      onClick={() => onShowDetails?.(item)}
      onKeyDown={(event) => {
        if (!opensDetails) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onShowDetails?.(item);
        }
      }}
    >
      <McpServerCapabilityCard.Header>
        <McpServerCapabilityCard.TitleBadge
          variant="success"
          icon={
            item.iconUrl ? (
              <img
                src={item.iconUrl}
                alt=""
                aria-hidden="true"
                className="size-4 object-contain"
              />
            ) : (
              <PromptIcon />
            )
          }
        >
          {item.name}
        </McpServerCapabilityCard.TitleBadge>
        {showActions && (
          <McpServerCapabilityCard.Menu
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <McpServerCapabilityCard.MenuButton
              aria-label={`Open ${item.name} menu`}
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen(true);
              }}
              onKeyDown={(event) => event.stopPropagation()}
            />
            <McpServerCapabilityCard.MenuContent
              onClick={(event) => event.stopPropagation()}
            >
              <McpServerCapabilityCard.MenuItem
                onClick={() => onShowDetails?.(item)}
              >
                <Eye className="size-4" />
                Details
              </McpServerCapabilityCard.MenuItem>
              {item.isCustom && (
                <McpServerCapabilityCard.MenuItem
                  onClick={() => onEditItem?.(item)}
                >
                  <Settings className="size-4" />
                  Edit
                </McpServerCapabilityCard.MenuItem>
              )}
              {item.isCustom && (
                <McpServerCapabilityCard.MenuItem
                  variant="destructive"
                  onClick={() => onDeleteItem?.(item)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </McpServerCapabilityCard.MenuItem>
              )}
            </McpServerCapabilityCard.MenuContent>
          </McpServerCapabilityCard.Menu>
        )}
      </McpServerCapabilityCard.Header>
      <McpServerCapabilityCard.Description title={description}>
        {description}
      </McpServerCapabilityCard.Description>
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
      <McpServerCapabilityCard.Divider className="mt-auto" />
      <McpServerCapabilityCard.Metrics>
        <McpServerCapabilityCard.Metric
          icon={<BracketsCurlyIcon />}
          value={inputFieldsCount}
          label="Input fields"
        />
        <McpServerCapabilityCard.Metric
          icon={<ChatsIcon />}
          value={messagesCount}
          label="Messages"
        />
        <McpServerCapabilityCard.Metric
          icon={<VinylRecordIcon className="rotate-90" />}
          value={0}
          label="Resources"
        />
      </McpServerCapabilityCard.Metrics>
    </McpServerCapabilityCard>
  );
}
