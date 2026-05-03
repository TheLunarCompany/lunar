import { cn } from "@/lib/utils";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Server,
  ShieldAlert,
  X,
} from "lucide-react";
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
  "group pointer-events-auto relative grid w-[min(420px,calc(100vw-2rem))] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 pr-12 shadow-[0_18px_48px_rgba(35,26,77,0.14),0_2px_8px_rgba(35,26,77,0.08)] transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-left-full data-[state=open]:animate-in data-[state=open]:slide-in-from-left",
  {
    variants: {
      variant: {
        default: "border-[#DFDCEB] text-[#231A4D]",
        info: "toast-info border-[#C9D8FF] bg-[#F7FAFF] text-[#1F2D5C]",
        "server-info":
          "toast-server-info border-[#CFC8FA] bg-[#FAF9FF] text-[#231A4D]",
        warning: "toast-warning border-[#F4C56A] bg-[#FFFBF1] text-[#432D08]",
        destructive: "destructive border-[#F0A3A3] bg-[#FFF7F7] text-[#4D1616]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const toastIconVariants = cva(
  "flex size-10 shrink-0 items-center justify-center rounded-lg",
  {
    variants: {
      variant: {
        default: "bg-[#EEEDFC] text-[#5147E4]",
        info: "bg-[#EAF0FF] text-[#315FEA]",
        "server-info": "bg-[#EEEDFC] text-[#5147E4]",
        warning: "bg-[#FFF0C2] text-[#996100]",
        destructive: "bg-[#FFE6E3] text-[#C7251A]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function ToastIcon({ variant }: Pick<ToastProps, "variant">) {
  const iconClassName = "size-5";

  switch (variant) {
    case "info":
      return <Info className={iconClassName} />;
    case "server-info":
      return <Server className={iconClassName} />;
    case "warning":
      return <AlertTriangle className={iconClassName} />;
    case "destructive":
      return <ShieldAlert className={iconClassName} />;
    default:
      return <CheckCircle2 className={iconClassName} />;
  }
}

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
          <div className="absolute top-2 right-2 flex size-7 items-center justify-center">
            {closeButton}
          </div>
        )}

        <div className={toastIconVariants({ variant })}>
          <ToastIcon variant={variant} />
        </div>
        <div className="min-w-0 py-4 pr-6">{content}</div>
        <div className="flex items-center self-center py-4 pr-2">
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
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-[#5147E4] px-3 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] focus:outline-hidden focus:ring-2 focus:ring-[#5147E4]/25 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:bg-[#D92D20] group-[.destructive]:hover:bg-[#B42318]",
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
    className={cn(
      "flex size-7 items-center justify-center rounded-md text-[#7F7999] transition-colors hover:bg-[#F2F0F8] hover:text-[#231A4D] focus:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-[#5147E4]/25 group-[.destructive]:text-[#8C2B25] group-[.destructive]:hover:bg-[#FFE6E3] group-[.destructive]:hover:text-[#4D1616]",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="size-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

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
      "wrap-break-word mt-0.5 line-clamp-2 text-sm leading-5 whitespace-normal text-current/75",
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
