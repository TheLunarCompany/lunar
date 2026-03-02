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
        <div className="absolute inset-0 z-[60] backdrop-blur-sm bg-black/20 flex items-start justify-center pointer-events-auto pt-[50px]">
          <div className="bg-white rounded-lg border-2 border-[#B4108B] p-4 shadow-lg pointer-events-auto w-[90%] flex items-center gap-4">
            <p className="flex-1 text-sm font-semibold text-[#1E1B4B]">
              {title}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={onClose}
                variant="ghost"
                className="!text-[#5147E4] bg-white weight-semibold !border-none"
                type="button"
              >
                {cancelButtonText}
              </Button>
              <Button
                variant="danger"
                className="bg-[#AD0149] hover:bg-[#AD0149]/90 text-white border-[#AD0149]"
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
        style={isOpen ? { filter: "blur(2px)" } : undefined}
      >
        {children}
      </div>
    </div>
  );
};
