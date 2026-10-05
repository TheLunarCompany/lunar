import { X } from "lucide-react";
import { useState } from "react";
import { Banner } from "@/components/ui/banner";

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
    <div className="relative">
      <Banner
        className="pr-12"
        description={
          <span>
            For the best experience, replace{" "}
            <code className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[13px] text-white">
              mcp-remote
            </code>{" "}
            with{" "}
            <code className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[13px] text-white">
              mcp-remote@0.1.36
            </code>{" "}
            in the agent configuration.{" "}
            <a
              href="https://docs.lunar.dev/mcpx/get_started/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white underline underline-offset-2 hover:text-white/85"
            >
              Quick Start Guide
            </a>
          </span>
        }
      />
      <button
        onClick={handleClose}
        className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-white/15"
        aria-label="Close banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
