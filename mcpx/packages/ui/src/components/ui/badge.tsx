import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-badge-success-border bg-badge-success-bg text-badge-success-fg",
        danger:
          "border-badge-danger-border bg-badge-danger-bg text-badge-danger-fg",
        warning:
          "border-badge-warning-border bg-badge-warning-bg text-badge-warning-fg",
        info: "border-badge-info-border bg-badge-info-bg text-badge-info-fg",
        purple:
          "border-badge-purple-border bg-badge-purple-bg text-badge-purple-fg",
      },
      size: {
        sm: "px-1.5 py-0.5 text-xs",
        md: "px-2 py-0.5 text-xs",
        lg: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "purple";

type BadgeSize = "sm" | "md" | "lg";

function Badge({
  className,
  variant,
  size,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
}): React.JSX.Element {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
