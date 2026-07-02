import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const nodeIndicatorBadgeVariants = cva(
  "absolute -right-3.5 -top-3.5 flex items-center justify-center rounded-[var(--border-radius-full)] p-1.5 shadow-[var(--shadow-node-indicator)]",
  {
    variants: {
      variant: {
        warning: "bg-[var(--colors-warning-400)]",
        info: "bg-[var(--colors-info-500)]",
        error: "bg-[var(--colors-error-700)]",
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
      <IconComponent className="size-4 text-white" />
    </div>
  );
}

export { NodeIndicatorBadge, nodeIndicatorBadgeVariants };
export type { NodeIndicatorBadgeProps };
