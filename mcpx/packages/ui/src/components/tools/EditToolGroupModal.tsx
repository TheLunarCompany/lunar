import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

interface EditToolGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  onGroupNameChange: (name: string) => void;
  groupDescription?: string;
  onGroupDescriptionChange?: (description: string) => void;
  error?: string | null;
  onSave: () => void;
  isSaving: boolean;
}

const styles = {
  modalContent: "max-w-lg bg-white border-gray-200",
  modalSpace: "space-y-4 py-2",
  modalLabel: "text-sm font-medium",
  modalCharacterCount: "text-xs text-gray-500",
  modalFooter: "flex justify-between items-center",
  modalCancelButton:
    "px-4 py-2 text-sm font-medium text-[#4F33CC] bg-transparent hover:bg-transparent border-0 shadow-none hover:opacity-80 transition-opacity",
  modalSaveButton:
    "px-4 py-2 bg-[#4F33CC] text-white rounded-md text-sm font-medium hover:bg-[#4F33CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
};

export function EditToolGroupModal({
  isOpen,
  onClose,
  groupName,
  onGroupNameChange,
  groupDescription = "",
  onGroupDescriptionChange,
  error,
  onSave,
  isSaving,
}: EditToolGroupModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={styles.modalContent}>
        <DialogTitle>Update Group</DialogTitle>
        <div className="border-t border-gray-200 w-full "></div>
        <DialogDescription className="text-black">
          Update the tool group name and description.
        </DialogDescription>
        <div className={styles.modalSpace}>
          <div className={styles.modalSpace}>
            <label htmlFor="groupName" className={styles.modalLabel}>
              Group Name
            </label>
            {error && (
              <div className="flex pt-1 items-center gap-1">
                <img
                  alt="Warning"
                  className="w-4 h-4"
                  src="/icons/warningCircle.png"
                />
                <p className="text-xs text-[var(--color-fg-danger)]">{error}</p>
              </div>
            )}
            <Input
              id="groupName"
              placeholder="Enter tool group name"
              value={groupName}
              onChange={(e) => onGroupNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSave();
                }
              }}
              maxLength={50}
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? "groupName-error" : undefined}
              className="border-gray-200"
            />
            {groupName.length > 49 && (
              <p className={styles.modalCharacterCount}>
                {groupName.length}/50 characters
              </p>
            )}
          </div>
          <div className={styles.modalSpace}>
            <label htmlFor="groupDescription" className={styles.modalLabel}>
              Description <span style={{ fontSize: "12px" }}>(optional)</span>
            </label>
            <Textarea
              id="groupDescription"
              placeholder="Enter tool group description"
              value={groupDescription}
              onChange={(e) => onGroupDescriptionChange?.(e.target.value)}
              rows={1}
              maxLength={200}
              className="bg-white border-gray-200"
            />
            {groupDescription.length > 190 && (
              <p className={styles.modalCharacterCount}>
                {groupDescription.length}/200 characters
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-gray-200"></div>
        <div className={styles.modalFooter}>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className={styles.modalCancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            className={styles.modalSaveButton}
            disabled={!groupName.trim() || isSaving}
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <Spinner size="small" className="text-white" />
                <span>Updating...</span>
              </div>
            ) : (
              "Update Group"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
