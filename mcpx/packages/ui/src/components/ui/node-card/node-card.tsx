import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const nodeCardVariants = cva(
  "relative flex flex-col items-start justify-center rounded-[var(--border-radius-lg)] bg-white p-3 transition-all",
  {
    variants: {
      variant: {
        default:
          "border border-solid border-[var(--colors-gray-200)] shadow-[var(--shadow-node-default)] hover:border-[var(--colors-primary-400)] hover:shadow-[var(--shadow-node-hover-primary)]",
        zero: "border border-dashed border-[var(--colors-gray-300)] shadow-[var(--shadow-node-default)] hover:border-[var(--colors-primary-400)] hover:shadow-[var(--shadow-node-hover-primary)]",
        warning:
          "border border-solid border-[var(--colors-warning-400)] hover:shadow-[var(--shadow-node-hover-warning)]",
        info: "border border-solid border-[var(--colors-info-500)] hover:shadow-[var(--shadow-node-hover-info)]",
        error:
          "border border-solid border-[var(--colors-error-700)] hover:shadow-[var(--shadow-node-hover-error)]",
        disabled:
          "border border-solid border-[var(--colors-gray-200)] bg-[var(--colors-gray-100)] shadow-[var(--shadow-node-default)]",
      },
      state: {
        default: "",
        active: "border-2",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        state: "active",
        className:
          "border-[var(--colors-primary-400)] shadow-[var(--shadow-node-active-primary)]",
      },
      {
        variant: "zero",
        state: "active",
        className:
          "border-[var(--colors-primary-400)] shadow-[var(--shadow-node-active-primary)]",
      },
      {
        variant: "warning",
        state: "active",
        className: "shadow-[var(--shadow-node-active-warning)]",
      },
      {
        variant: "info",
        state: "active",
        className: "shadow-[var(--shadow-node-active-info)]",
      },
      {
        variant: "error",
        state: "active",
        className: "shadow-[var(--shadow-node-active-error)]",
      },
      {
        variant: "disabled",
        state: "active",
        className: "shadow-[var(--shadow-node-default)]",
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
