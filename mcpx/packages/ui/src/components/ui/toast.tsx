import { cn } from "@/lib/utils";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Check, CircleCheck, Copy, Info, X } from "lucide-react";
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
      "fixed z-100 m-4 flex max-h-screen flex-col-reverse overflow-visible p-0 sm:flex-col",
      {
        "top-0 left-1/2 -translate-x-1/2": position === "top-center",
        "top-0 right-0": position === "top-right",
        "bottom-0 left-1/2 -translate-x-1/2": position === "bottom-center",
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
  "group pointer-events-auto relative flex w-[min(420px,calc(100vw-2rem))] items-center gap-3 overflow-hidden rounded-lg border p-4 pr-12 text-mcpx-text shadow-lg transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-left-full data-[state=open]:animate-in data-[state=open]:slide-in-from-left",
  {
    variants: {
      variant: {
        default: "border-mcpx-success-text bg-mcpx-success-bg",
        info: "toast-info border-mcpx-info-text bg-mcpx-selected-weak",
        "server-info":
          "toast-server-info border-mcpx-info-text bg-mcpx-selected-weak",
        warning: "toast-warning border-mcpx-warning-strong bg-mcpx-warning-bg",
        destructive:
          "destructive border-mcpx-danger-text bg-mcpx-danger-bg text-mcpx-danger-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type ToastVariant = VariantProps<typeof toastVariants>["variant"];

const toastIconVariants = cva(
  "flex size-5 shrink-0 items-center justify-center",
  {
    variants: {
      variant: {
        default: "text-mcpx-success-text",
        info: "text-mcpx-info-text",
        "server-info": "text-mcpx-info-text",
        warning: "text-mcpx-warning-strong",
        destructive: "text-mcpx-danger-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function ToastIcon({ variant }: { variant?: ToastVariant }) {
  const iconClassName = "size-5";

  switch (variant) {
    case "info":
      return <Info aria-hidden="true" className={iconClassName} />;
    case "server-info":
      return <Info aria-hidden="true" className={iconClassName} />;
    case "warning":
      return <AlertTriangle aria-hidden="true" className={iconClassName} />;
    case "destructive":
      return <AlertTriangle aria-hidden="true" className={iconClassName} />;
    default:
      return <CircleCheck aria-hidden="true" className={iconClassName} />;
  }
}

const toastCloseClassName =
  "flex size-6 items-center justify-center rounded-full text-mcpx-text-secondary transition-colors hover:bg-mcpx-surface-hover hover:text-mcpx-text focus:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring/50";

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & {
      isClosable?: boolean;
      domain?: string;
      /** Plain-text message to offer a copy button for. Errors only. */
      copyText?: string;
    }
>(
  (
    {
      className,
      variant,
      isClosable: isClosableProp = true,
      copyText,
      ...props
    },
    ref,
  ) => {
    const children = props.children as React.ReactNode[];
    const content = children?.[0];
    const actionButton = children?.[1];
    const closeButton = children?.[2];

    // navigator.clipboard is undefined outside a secure context, and mcpx gets
    // served over plain http, so render nothing rather than a dead button.
    const copyable =
      variant === "destructive" && navigator.clipboard ? copyText : undefined;

    return (
      <ToastPrimitives.Root
        ref={ref}
        className={cn(
          toastVariants({ variant }),
          copyable && "pr-20",
          className,
        )}
        duration={props.duration ?? 4000}
        {...props}
      >
        {(isClosableProp || copyable) && (
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-0.5">
            {copyable && <ToastCopy value={copyable} />}
            {isClosableProp && closeButton}
          </div>
        )}

        <div className={toastIconVariants({ variant })}>
          <ToastIcon variant={variant} />
        </div>
        {/* The viewport is overflow-visible, so it will not scroll an oversized
            toast for us. Bound it here. 6rem clears the viewport's m-4. */}
        <div className="max-h-[calc(100vh-6rem)] min-w-0 flex-1 overflow-y-auto">
          {content}
        </div>
        {actionButton && (
          <div className="flex shrink-0 items-center self-center">
            {actionButton}
          </div>
        )}
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
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-mcpx-action px-3 text-sm font-medium text-mcpx-tooltip-text transition-colors hover:bg-mcpx-action-hover focus:outline-hidden focus:ring-2 focus:ring-ring/50 disabled:pointer-events-none disabled:bg-mcpx-surface-disabled disabled:text-mcpx-text-disabled group-[.destructive]:bg-destructive group-[.destructive]:text-destructive-foreground group-[.destructive]:hover:bg-[var(--mcpx-danger-action-hover)]",
      className,
    )}
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
    aria-label="Dismiss notification"
    className={cn(toastCloseClassName, className)}
    toast-close=""
    {...props}
  >
    <X className="size-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

// Errors are the messages users need to paste into a ticket or a chat, and they
// are also the ones long enough to be annoying to select by hand out of a toast
// that dismisses itself.
const ToastCopy = ({ value }: { value: string }) => {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const label = copied ? "Copied" : "Copy message";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={toastCloseClassName}
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
};

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "wrap-break-word text-sm font-semibold leading-5 whitespace-normal",
      className,
    )}
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
      // No clamp: messages come from upstream servers, so we cannot know where
      // the useful part sits. min-w-0 stops an unbreakable token (a JWT, a URL)
      // from widening the grid track until overflow-hidden clips it.
      "wrap-break-word mt-0.5 min-w-0 text-sm leading-5 whitespace-normal text-mcpx-text-secondary",
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
  ToastIcon,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  toastCloseClassName,
  toastIconVariants,
  toastVariants,
  type ToastActionElement,
  type ToastProps,
  type ToastVariant,
};
