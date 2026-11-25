import { cva, type VariantProps } from "class-variance-authority";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const nodeBadgeVariants = cva("w-fit max-w-full border-0 whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-mcpx-surface-tertiary text-mcpx-text-secondary",
      warning: "bg-mcpx-warning-bg text-mcpx-text",
      info: "bg-mcpx-selected-weak text-mcpx-action",
      error: "bg-mcpx-danger-bg text-mcpx-danger-text",
      disabled: "bg-mcpx-surface-disabled text-mcpx-text-tertiary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type NodeBadgeProps = Omit<BadgeProps, "variant"> &
  VariantProps<typeof nodeBadgeVariants>;

function NodeBadge({
  className,
  variant = "default",
  size = "xs",
  ...props
}: NodeBadgeProps) {
  const nodeVariant = variant ?? "default";

  return (
    <Badge
      data-slot="node-badge"
      data-variant={nodeVariant}
      variant="secondary"
      size={size ?? "xs"}
      className={cn(nodeBadgeVariants({ variant: nodeVariant }), className)}
      {...props}
    />
  );
}

export { NodeBadge, nodeBadgeVariants };
export type { NodeBadgeProps };
