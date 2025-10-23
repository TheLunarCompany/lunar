import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        warning : "bg-[#FF9500] hover:enabled:bg-bg-[rgba(255,149,0,0.1)] border-button-danger text-white shadow-sm ",
        primary:
          "bg-button-primary hover:enabled:bg-button-hover border-button-primary fill-primary-foreground text-primary-foreground shadow r",
        secondary:
          "bg-button-secondary hover:enabled:bg-button-secondary-hover border-bg-button-secondary border text-secondary-foreground shadow-sm",
        danger:
          "bg-button-danger hover:enabled:bg-button-danger-hover border-button-danger text-danger-foreground shadow-sm",
        ghost:
          "bg-transparent hover:enabled:bg-transparent border-transparent text-foreground opacity-80 hover:opacity-100",

      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger" | "ghost" | "warning";
    size?: "default" | "sm" | "lg" | "icon";
    asChild?: boolean;
    ref?: React.RefObject<unknown>;
  }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
