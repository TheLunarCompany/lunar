"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { McpServerStatus } from "@/types/mcp-server";

const CONNECTED_STATUSES: McpServerStatus[] = [
  "connected_running",
  "connected_stopped",
];

interface AuthenticationDialogProps {
  userCode: string | null;
  serverStatus?: McpServerStatus;
  onClose: () => void;
}

export const AuthenticationDialog = ({
  userCode,
  serverStatus,
  onClose,
}: AuthenticationDialogProps) => {
  const [copied, setCopied] = React.useState(false);
  const prevStatusRef = React.useRef<McpServerStatus | undefined>(serverStatus);

  React.useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = serverStatus;

    if (
      userCode &&
      prevStatus === "pending_auth" &&
      serverStatus !== undefined &&
      CONNECTED_STATUSES.includes(serverStatus)
    ) {
      onClose();
    }
  }, [serverStatus, userCode, onClose]);

  const handleCopy = async () => {
    if (!userCode) return;
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  };

  return (
    <Dialog
      open={!!userCode}
      onOpenChange={(open) => {
        // Only close when explicitly requested (X button or Escape)
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-md bg-(--color-bg-container) border border-(--color-border-primary) rounded-lg p-0 overflow-hidden"
        onInteractOutside={(e) => {
          // Prevent closing on outside clicks - user must use X button
          e.preventDefault();
        }}
      >
        {/* Header */}
        <DialogHeader className="border-b border-(--color-border-primary) px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-(--color-bg-interactive) shrink-0">
              <ShieldCheck className="w-[18px] h-[18px] text-(--color-fg-interactive)" />
            </div>
            <DialogTitle className="text-base font-semibold text-(--color-text-primary) leading-snug">
              Authentication in Progress
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-(--color-text-secondary) leading-relaxed pl-12">
            A browser window has opened. Enter this code if prompted, or confirm
            it matches what&apos;s shown.
          </DialogDescription>
        </DialogHeader>

        {/* Device code */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-(--color-text-secondary)">
            Device Code
          </p>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full group flex items-center justify-between gap-4 rounded-lg border border-(--color-border-interactive) bg-(--color-bg-interactive) px-5 py-4 transition-all hover:bg-(--color-bg-interactive-hover) hover:border-(--color-border-interactive-hover) focus:outline-hidden focus-visible:ring-2 focus-visible:ring-(--color-border-interactive)"
          >
            <span className="font-mono text-2xl font-bold tracking-[0.2em] text-(--color-text-primary) select-all">
              {userCode}
            </span>

            <span className="shrink-0 flex items-center gap-1.5 text-xs font-medium min-w-[52px] justify-end transition-colors">
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-(--color-fg-success)" />
                  <span className="text-(--color-fg-success)">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-(--color-fg-interactive) opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="text-(--color-fg-interactive) opacity-70 group-hover:opacity-100 transition-opacity">
                    Copy
                  </span>
                </>
              )}
            </span>
          </button>

          {/* Waiting status */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--color-fg-success) opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-(--color-fg-success)" />
            </span>
            <p className="text-xs text-(--color-text-secondary)">
              Waiting for authentication to complete…
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-(--color-border-primary) px-6 py-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="w-full text-(--color-fg-interactive) border-(--color-border-interactive) hover:bg-(--color-bg-interactive-hover)"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
