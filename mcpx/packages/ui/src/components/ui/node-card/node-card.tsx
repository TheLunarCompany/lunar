import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const nodeCardVariants = cva(
  "relative flex flex-col items-start justify-center rounded-[var(--border-radius-lg)] bg-mcpx-surface p-3 transition-all",
  {
    variants: {
      variant: {
        default:
          "border border-solid border-mcpx-border-subtle shadow-none hover:border-mcpx-selected",
        zero: "border border-solid border-mcpx-border-subtle shadow-none",
        warning: "border border-solid border-mcpx-warning-strong shadow-none",
        info: "border border-solid border-mcpx-info-text shadow-none",
        error: "border border-solid border-mcpx-danger-text shadow-none",
        disabled:
          "border border-solid border-mcpx-border-subtle bg-mcpx-surface-tertiary shadow-none",
      },
      state: {
        default: "",
        active: "",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        state: "active",
        className: "border-mcpx-selected shadow-none",
      },
      {
        variant: "zero",
        state: "active",
        className: "border-mcpx-selected shadow-none",
      },
      {
        variant: "warning",
        state: "active",
        className: "shadow-none",
      },
      {
        variant: "info",
        state: "active",
        className: "shadow-none",
      },
      {
        variant: "error",
        state: "active",
        className: "shadow-none",
      },
      {
        variant: "disabled",
        state: "active",
        className: "shadow-none",
      },
    ],
    defaultVariants: {
      variant: "default",
      state: "default",
    },
  },
);

type NodeCardProps = React.ComponentProps<"div"> &
  VariantProps<typeof nodeCardVariants>;

function NodeCard({
  className,
  variant,
  state,
  children,
  ...props
}: NodeCardProps) {
  return (
    <div
      data-slot="node-card"
      data-variant={variant}
      data-state={state}
      className={cn(nodeCardVariants({ variant, state }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { NodeCard, nodeCardVariants };
export type { NodeCardProps };
