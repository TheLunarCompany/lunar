import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const nodeIndicatorBadgeVariants = cva(
  "absolute -right-3.5 -top-3.5 flex items-center justify-center rounded-[var(--border-radius-full)] p-1.5 shadow-[var(--mcpx-shadow-weak)]",
  {
    variants: {
      variant: {
        warning: "bg-mcpx-warning-strong",
        info: "bg-mcpx-info-text",
        error: "bg-destructive",
      },
    },
    defaultVariants: {
      variant: "warning",
    },
  },
);

const iconMap = {
  warning: Info,
  info: Info,
  error: AlertTriangle,
} as const;

type NodeIndicatorBadgeProps = React.ComponentProps<"div"> &
  VariantProps<typeof nodeIndicatorBadgeVariants> & {
    icon?: React.ElementType;
  };

function NodeIndicatorBadge({
  className,
  variant = "warning",
  icon,
  ...props
}: NodeIndicatorBadgeProps) {
  const IconComponent = icon ?? iconMap[variant!];

  return (
    <div
      data-slot="node-indicator-badge"
      data-variant={variant}
      className={cn(nodeIndicatorBadgeVariants({ variant }), className)}
      {...props}
    >
      <IconComponent className="size-4 text-mcpx-tooltip-text" />
    </div>
  );
}

export { NodeIndicatorBadge, nodeIndicatorBadgeVariants };
export type { NodeIndicatorBadgeProps };
