import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--exo-spacing-2x-small)] border border-transparent bg-clip-padding text-sm font-semibold leading-6 whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-mcpx-surface-disabled disabled:text-mcpx-text-disabled disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-mcpx-selected text-primary-foreground hover:bg-mcpx-selected-hover",
        outline:
          "border-mcpx-border bg-mcpx-surface text-mcpx-text hover:bg-mcpx-surface-hover hover:text-mcpx-text aria-expanded:bg-mcpx-surface-hover aria-expanded:text-mcpx-text",
        secondary:
          "border-mcpx-border bg-mcpx-surface text-mcpx-text hover:bg-mcpx-surface-hover aria-expanded:bg-mcpx-surface-hover aria-expanded:text-mcpx-text",
        ghost:
          "hover:bg-mcpx-surface-hover hover:text-foreground aria-expanded:bg-mcpx-surface-hover aria-expanded:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[var(--mcpx-danger-action-hover)] focus-visible:border-destructive focus-visible:ring-destructive/20",
        link: "text-mcpx-info-text underline-offset-4 hover:underline",
        "node-card":
          "border-mcpx-border bg-mcpx-surface text-mcpx-text hover:bg-mcpx-surface-hover",
      },
      size: {
        default:
          "h-8 gap-2 px-3 in-data-[slot=button-group]:rounded-[var(--exo-spacing-2x-small)] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 px-2 text-xs in-data-[slot=button-group]:rounded-[var(--exo-spacing-2x-small)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2 in-data-[slot=button-group]:rounded-[var(--exo-spacing-2x-small)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 in-data-[slot=button-group]:rounded-[var(--exo-spacing-2x-small)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 in-data-[slot=button-group]:rounded-[var(--exo-spacing-2x-small)]",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

export { Button, buttonVariants };
