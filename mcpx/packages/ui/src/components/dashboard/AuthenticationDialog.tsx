import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copyable } from "@/components/ui/copyable";

interface AuthenticationDialogProps {
  userCode: string | null;
  onClose: () => void;
}

export const AuthenticationDialog = ({
  userCode,
  onClose,
}: AuthenticationDialogProps) => {
  return (
    <Dialog
      open={!!userCode}
      onOpenChange={(open) => {
        // Only close when explicitly requested (X button or Escape)
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        onInteractOutside={(e) => {
          // Prevent closing on outside clicks - user must use X button
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Authentication Started</DialogTitle>
          <DialogDescription>
            Please complete the authentication in the opened window.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Your device code:</p>
          <div onClick={(e) => e.stopPropagation()}>
            <Copyable value={userCode || ""} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
