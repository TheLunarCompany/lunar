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
  modalContent: "max-w-lg bg-mcpx-surface border-mcpx-border-subtle",
  modalSpace: "space-y-4 py-2",
  modalLabel: "text-sm font-medium",
  modalCharacterCount: "text-xs text-mcpx-text-tertiary",
  modalFooter: "flex justify-between items-center",
  modalCancelButton:
    "px-4 py-2 text-sm font-medium text-mcpx-selected bg-transparent hover:bg-transparent border-0 shadow-none hover:opacity-80 transition-opacity",
  modalSaveButton:
    "px-4 py-2 bg-mcpx-selected text-mcpx-tooltip-text rounded-md text-sm font-medium hover:bg-mcpx-selected transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
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
        <DialogDescription className="text-black">
          Update the tool group name and description.
        </DialogDescription>
        <div className={styles.modalSpace}>
          <div className="py-2">
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
                <p className="text-xs text-destructive">{error}</p>
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
              className="mt-2 border-mcpx-border-subtle"
            />
            {groupName.length > 49 && (
              <p className={styles.modalCharacterCount}>
                {groupName.length}/50 characters
              </p>
            )}
          </div>
          <div className="py-2">
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
              className="mt-2 border-mcpx-border-subtle"
            />
            {groupDescription.length > 190 && (
              <p className={styles.modalCharacterCount}>
                {groupDescription.length}/200 characters
              </p>
            )}
          </div>
        </div>
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
                <Spinner className="text-mcpx-tooltip-text" />
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
