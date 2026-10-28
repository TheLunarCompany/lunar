import { cn } from "@/lib/utils";
import {
  ToastIcon,
  toastCloseClassName,
  toastIconVariants,
  toastVariants,
} from "@/components/ui/toast";
import { X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  details?: Array<{ label: string; message: string }>;
  onClose?: () => void;
  variant?: "destructive" | "warning";
}

export function ErrorBanner({
  message,
  details,
  onClose,
  variant = "destructive",
}: ErrorBannerProps): React.JSX.Element {
  const isWarning = variant === "warning";

  return (
    <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2">
      <div className={toastVariants({ variant })}>
        <div className={toastIconVariants({ variant })}>
          <ToastIcon variant={variant} />
        </div>
        <div className="wrap-break-word min-w-0 flex-1 text-sm leading-5 whitespace-normal">
          <div className="font-semibold">{message}</div>
          {details && details.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {details.map(({ label, message: detailMessage }, index) => (
                <li key={`${label}-${index}`}>
                  <span className="font-semibold">{label}</span>:{" "}
                  {detailMessage}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Dismiss notification"
            className={cn(
              toastCloseClassName,
              "absolute top-1/2 right-3 -translate-y-1/2",
              !isWarning && "text-mcpx-danger-text",
            )}
            type="button"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
