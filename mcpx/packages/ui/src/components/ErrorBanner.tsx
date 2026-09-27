import { cn } from "@/lib/utils";
import { X, AlertTriangle } from "lucide-react";

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
    <div className="absolute top-8 left-1/2 z-50 w-[min(950px,calc(100%-3rem))] -translate-x-1/2">
      <div
        className={cn(
          "relative grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-4 pr-12 shadow-[0_18px_48px_rgba(35,26,77,0.14),0_2px_8px_rgba(35,26,77,0.08)]",
          isWarning
            ? "border-[#F4C56A] bg-[#FFFBF1] text-[#432D08]"
            : "border-[#F0A3A3] bg-[#FFF7F7] text-[#4D1616]",
        )}
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            isWarning
              ? "bg-[#FFF0C2] text-[#996100]"
              : "bg-[#FFE6E3] text-[#C7251A]",
          )}
        >
          <AlertTriangle className="size-5" />
        </div>
        <div className="wrap-break-word min-w-0 py-4 pr-6 text-sm font-medium leading-5 whitespace-normal">
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
            className={cn(
              "absolute top-2 right-2 flex size-7 items-center justify-center rounded-md transition-colors focus:outline-hidden focus:ring-2",
              isWarning
                ? "text-[#7A5A18] hover:bg-[#FFF0C2] hover:text-[#432D08] focus:ring-[#996100]/25"
                : "text-[#8C2B25] hover:bg-[#FFE6E3] hover:text-[#4D1616] focus:ring-[#C7251A]/25",
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
