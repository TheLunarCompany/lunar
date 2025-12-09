import { cn } from "@/lib/utils";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { Hexagon, X } from "lucide-react";
import * as React from "react";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> & {
    position?:
      | "top-center"
      | "top-right"
      | "bottom-center"
      | "bottom-right"
      | "bottom-left";
  }
>(({ className, position = "bottom-left", ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed z-[100] rounded-[20px] p-0 m-4 flex max-h-screen  flex-col-reverse   sm:flex-col  overflow-visible",
      {
        "top-0 left-[calc(50%-220px)]": position === "top-center",
        "top-0 right-0": position === "top-right",
        "bottom-0 right-1/2": position === "bottom-center",
        "bottom-0 right-0": position === "bottom-right",
        "bottom-0 left-0": position === "bottom-left",
      },
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex  items-center justify-start space-x-2 overflow-hidden rounded-[20px] border p-4  shadow-lg transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-left-full data-[state=open]:slide-in-from-left overflow-visible",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        info: "bg-[#EEEDFC] border-[1px] border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] ",
        "server-info":
          "bg-[#EEEDFC] border-[1px] border-[#5147E4] text-[#231A4D] ",
        warning: "border-[#DD0EA4] border-[1px]  bg-[#F4DCF1] text-[#231A4D]",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & {
      isClosable?: boolean;
      domain?: string;
    }
>(
  (
    { className, variant, isClosable: isClosableProp = true, ...props },
    ref,
  ) => {
    const children = props.children as React.ReactNode[];
    const content = children?.[0];
    const actionButton = children?.[1];
    const closeButton = children?.[2];

    return (
      <ToastPrimitives.Root
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        duration={props.duration ?? 4000}
        {...props}
      >
        {isClosableProp && (
          <div className="flex items-center justify-center absolute top-[-4px] border border-1 border-[#7F7999]  right-[-4px] w-4 h-4  bg-white rounded-full">
            {closeButton}
          </div>
        )}

        <div className="relative overflow-visible gap-2 flex flex-row items-center justify-between !m-0">
          <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-fg-interactive)] to-[var(--color-fg-primary-accent)] rounded-xl flex items-center justify-center">
            <Hexagon className="w-6 h-6 text-[var(--color-text-primary-inverted)]" />
          </div>

          <div className="max-w-[280px] break-words whitespace-normal min-w-0">
            {content}
          </div>

          {actionButton}
        </div>
      </ToastPrimitives.Root>
    );
  },
);
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    style={{
      backgroundColor: "#DD0EA4",
      color: "white",
      borderColor: "#DD0EA4",
    }}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "rounded-md  text-foreground/50  transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-2 w-2" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(" font-semibold break-words whitespace-normal", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "text-sm opacity-90 break-words whitespace-normal truncate",
      className,
    )}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastActionElement,
  type ToastProps,
};
