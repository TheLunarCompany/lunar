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
        className="max-w-md bg-card border border-border rounded-lg p-0 overflow-hidden"
        onInteractOutside={(e) => {
          // Prevent closing on outside clicks - user must use X button
          e.preventDefault();
        }}
      >
        {/* Header */}
        <DialogHeader className="border-b border-border px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mcpx-selected-weak">
              <ShieldCheck className="w-[18px] h-[18px] text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground leading-snug">
              Authentication in Progress
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed pl-12">
            A browser window has opened. Enter this code if prompted, or confirm
            it matches what&apos;s shown.
          </DialogDescription>
        </DialogHeader>

        {/* Device code */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Device Code
          </p>

          <button
            type="button"
            onClick={handleCopy}
            className="group flex w-full items-center justify-between gap-4 rounded-lg border border-ring bg-mcpx-selected-weak px-5 py-4 transition-all hover:border-ring hover:bg-accent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-mono text-2xl font-bold tracking-[0.2em] text-foreground select-all">
              {userCode}
            </span>

            <span className="shrink-0 flex items-center gap-1.5 text-xs font-medium min-w-[52px] justify-end transition-colors">
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-mcpx-success-text" />
                  <span className="text-mcpx-success-text">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="text-primary opacity-70 group-hover:opacity-100 transition-opacity">
                    Copy
                  </span>
                </>
              )}
            </span>
          </button>

          {/* Waiting status */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mcpx-success-text opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mcpx-success-text" />
            </span>
            <p className="text-xs text-muted-foreground">
              Waiting for authentication to complete…
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="w-full text-primary border-ring hover:bg-accent"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
