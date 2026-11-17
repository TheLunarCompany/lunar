import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  children: ReactNode;
}

export const ConfirmDeleteDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmButtonText = "Delete",
  cancelButtonText = "Cancel",
  children,
}: ConfirmDeleteDialogProps) => {
  return (
    <div className="relative flex-1 flex flex-col  min-h-0">
      {isOpen && (
        <div className="absolute inset-0 z-60 flex items-start justify-center bg-[var(--mcpx-scrim)] pt-[50px] pointer-events-auto">
          <div className="bg-mcpx-surface rounded-lg border-2 border-[var(--mcpx-route-active)] p-4 shadow-lg pointer-events-auto w-[90%] flex items-center gap-4">
            <p className="flex-1 text-sm font-semibold text-mcpx-text">
              {title}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={onClose}
                variant="ghost"
                className="text-mcpx-selected! bg-mcpx-surface weight-semibold border-none!"
                type="button"
              >
                {cancelButtonText}
              </Button>
              <Button
                variant="destructive"
                className="bg-destructive hover:bg-destructive/90 text-mcpx-tooltip-text border-destructive"
                onClick={onConfirm}
                type="button"
              >
                {confirmButtonText}
              </Button>
            </div>
          </div>
        </div>
      )}
      <div
        className={`flex flex-col flex-1 min-h-0 ${isOpen ? "pointer-events-none" : ""}`}
      >
        {children}
      </div>
    </div>
  );
};
