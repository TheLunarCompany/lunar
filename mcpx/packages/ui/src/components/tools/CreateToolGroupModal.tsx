import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

interface CreateToolGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  newGroupName: string;
  onGroupNameChange: (name: string) => void;
  onSave: () => void;
  isCreating: boolean;
  selectedToolsCount: number;
}

const styles = {
  modalContent: "max-w-md",
  modalSpace: "space-y-4 py-4",
  modalLabel: "text-sm font-medium",
  modalCharacterCount: "text-xs text-gray-500",
  modalFooter: "flex justify-end gap-2",
  modalCancelButton:
    "px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors",
  modalCreateButton:
    "px-4 py-2 bg-[#4F33CC] text-white rounded-md text-sm font-medium hover:bg-[#4F33CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
};

export function CreateToolGroupModal({
  isOpen,
  onClose,
  newGroupName,
  onGroupNameChange,
  onSave,
  isCreating,
  selectedToolsCount,
}: CreateToolGroupModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={styles.modalContent}>
        <DialogHeader>
          <DialogTitle>Create Tool Group</DialogTitle>
          <DialogDescription>
            Create a new tool group with the selected tools.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.modalSpace}>
          <div className={styles.modalSpace}>
            <label htmlFor="groupName" className={styles.modalLabel}>
              Group Name
            </label>
            <Input
              id="groupName"
              placeholder="Enter tool group name"
              value={newGroupName}
              onChange={(e) => onGroupNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSave();
                }
              }}
              maxLength={50}
              autoFocus
            />
            {newGroupName.length > 49 && (
              <p className={styles.modalCharacterCount}>
                {newGroupName.length}/50 characters
              </p>
            )}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isCreating}
            className={styles.modalCancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            className={styles.modalCreateButton}
            disabled={
              !newGroupName.trim() || isCreating || selectedToolsCount === 0
            }
          >
            {isCreating ? (
              <div className="flex items-center gap-2">
                <Spinner size="small" className="text-white" />
                <span>Creating...</span>
              </div>
            ) : (
              "Create Group"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
