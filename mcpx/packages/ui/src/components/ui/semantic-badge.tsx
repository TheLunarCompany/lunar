import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

export type SemanticBadgeTone =
  | "neutral"
  | "disabled"
  | "success"
  | "inactive"
  | "danger"
  | "info"
  | "pending"
  | "purple"
  | "warning";

const semanticBadgeVariants = cva(
  "h-[22px] rounded-full border-0 leading-[18px]",
  {
    variants: {
      tone: {
        neutral: "bg-mcpx-surface-tertiary text-mcpx-text-secondary",
        disabled: "bg-mcpx-surface-disabled text-mcpx-text-tertiary",
        success: "bg-mcpx-success-bg text-mcpx-success-text",
        inactive: "bg-mcpx-selected-weak text-mcpx-selected",
        danger: "bg-mcpx-danger-bg text-mcpx-danger-text",
        info: "bg-mcpx-selected-weak text-mcpx-action",
        pending: "bg-mcpx-warning-bg text-mcpx-text",
        purple: "bg-mcpx-selected-weak text-mcpx-data-purple",
        warning: "bg-mcpx-warning-bg text-mcpx-warning-strong",
      },
      showDot: {
        true: "pl-1.5 pr-2",
        false: "px-2",
      },
    },
    defaultVariants: {
      tone: "neutral",
      showDot: true,
    },
  },
);

export interface SemanticBadgeProps extends Omit<BadgeProps, "variant"> {
  tone?: SemanticBadgeTone;
  showDot?: boolean;
}

export function SemanticBadge({
  children,
  className,
  tone = "neutral",
  showDot = true,
  ...props
}: SemanticBadgeProps) {
  return (
    <Badge
      {...props}
      variant="secondary"
      size="md"
      className={cn(
        semanticBadgeVariants({ tone, showDot }),
        "max-w-full min-w-0",
        className,
      )}
    >
      {showDot && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden
        />
      )}
      <span className="min-w-0 truncate">{children}</span>
    </Badge>
  );
}
