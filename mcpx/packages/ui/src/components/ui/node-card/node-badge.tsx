import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const nodeBadgeVariants = cva(
  "h-auto w-fit max-w-full rounded-[var(--border-radius-sm)] border-transparent px-2 py-0.5 leading-[18px] whitespace-nowrap",
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

function NodeBadge({
  className,
  variant = "default",
  ...props
}: NodeBadgeProps) {
  return (
    <Badge
      data-slot="node-badge"
      data-variant={variant}
      variant="secondary"
      size="md"
      className={cn(nodeBadgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { NodeBadge, nodeBadgeVariants };
export type { NodeBadgeProps };
