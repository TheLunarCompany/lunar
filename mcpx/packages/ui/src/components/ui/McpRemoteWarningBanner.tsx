import { X, Sparkles, CheckCircle, ArrowRight } from "lucide-react";
import { useState } from "react";

interface McpRemoteWarningBannerProps {
  onClose: () => void;
}

export function McpRemoteWarningBanner({
  onClose,
}: McpRemoteWarningBannerProps) {
  const [isVisible, setIsVisible] = useState(() => {
    const hasClosedWarning = localStorage.getItem("mcpRemoteWarningClosed");
    if (hasClosedWarning === "true") {
      setTimeout(() => onClose(), 0);
      return false;
    }
    return true;
  });

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem("mcpRemoteWarningClosed", "true");
    onClose();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-yellow-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-900">
              To get the best experience, we recommend replacing your mcp-remote
              in the agent configuration.
            </span>
          </div>

          <div className="space-y-2 text-sm text-yellow-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>
                Replace:{" "}
                <code className="bg-yellow-100 px-2 py-1 rounded text-yellow-900 font-mono">
                  mcp-remote
                </code>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-green-600" />
              <span>
                With:{" "}
                <code className="bg-yellow-100 px-2 py-1 rounded text-yellow-900 font-mono">
                  mcp-remote@0.1.21
                </code>
              </span>
            </div>
          </div>

          <div className="mt-3">
            <a
              href="https://docs.lunar.dev/mcpx/get_started/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-yellow-700 hover:text-yellow-900 underline"
            >
              For step-by-step guidance, check out our Quick Start Guide
            </a>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="ml-4 p-1 hover:bg-yellow-100 rounded-full transition-colors duration-200"
          aria-label="Close banner"
        >
          <X className="w-4 h-4 text-yellow-600" />
        </button>
      </div>
    </div>
  );
}
