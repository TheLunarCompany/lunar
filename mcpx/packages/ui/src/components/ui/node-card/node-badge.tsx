import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const nodeBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-[var(--border-radius-full)] px-2 py-0.5 text-xs font-medium leading-[18px] whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-[var(--colors-gray-100)] text-[var(--colors-gray-500)]",
        warning:
          "bg-[var(--colors-warning-100)] text-[var(--colors-warning-500)]",
        info: "bg-[var(--colors-info-50)] text-[var(--colors-info-700)]",
        error: "bg-[#ffe6f5] text-[var(--colors-error-700)]",
        disabled: "bg-[var(--colors-gray-200)] text-[var(--colors-gray-500)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type NodeBadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof nodeBadgeVariants>;

function NodeBadge({ className, variant, ...props }: NodeBadgeProps) {
  return (
    <span
      data-slot="node-badge"
      data-variant={variant}
      className={cn(nodeBadgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { NodeBadge, nodeBadgeVariants };
export type { NodeBadgeProps };
