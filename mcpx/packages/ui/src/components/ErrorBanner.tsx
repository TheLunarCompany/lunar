import { X, AlertTriangle } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onClose?: () => void;
}

export function ErrorBanner({
  message,
  onClose,
}: ErrorBannerProps): React.JSX.Element {
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50">
      <div
        className="min-h-[52px] max-w-[950px] p-4 flex items-center gap-3 rounded-2xl relative"
        style={{
          background: "#FFF3F6",
          borderRadius: "16px",
          border: "1px solid #AD0149",
          boxShadow: "0 8px 16px 0 rgba(0, 0, 0, 0.25)",
        }}
      >
        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
        <div
          className="flex-1 font-medium"
          style={{
            color: "#1E1B4B",
            fontSize: "14px",
          }}
        >
          {message}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full border p-0 flex items-center justify-center bg-white hover:bg-gray-50 transition-colors"
            style={{
              borderColor: "#1E1B4B",
            }}
          >
            <X
              className="h-2 w-2"
              style={{
                color: "#1E1B4B",
              }}
            />
          </button>
        )}
      </div>
    </div>
  );
}
