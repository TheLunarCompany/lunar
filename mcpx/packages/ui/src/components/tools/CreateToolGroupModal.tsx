import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface CreateToolGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  newGroupName: string;
  onGroupNameChange: (name: string) => void;
  newGroupDescription?: string;
  onGroupDescriptionChange?: (description: string) => void;
  error?: string | null;
  onSave: () => void;
  isCreating: boolean;
  selectedToolsCount: number;
}

export function CreateToolGroupModal({
  isOpen,
  onClose,
  newGroupName,
  onGroupNameChange,
  newGroupDescription = "",
  onGroupDescriptionChange,
  error,
  onSave,
  isCreating,
  selectedToolsCount,
}: CreateToolGroupModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[600px] overflow-x-hidden max-h-[85vh] w-[90vw] flex flex-col p-0 bg-white border border-gray-200 rounded-lg !h-auto [&>button:last-child]:hidden">
        <div className="flex items-center justify-between pb-4 px-6 pt-6 border-b border-gray-200">
          <DialogTitle className="text-[24px] text-[var(--text-colours-color-text-primary)] font-semibold">
            Create Tool Group
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-6 py-4">
          <DialogHeader>
            <DialogDescription>
              Create a new tool group with the selected tools.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label htmlFor="groupName" className="text-sm font-semibold">
                Group Name
              </label>
              {error && (
                <div className="flex pt-1 items-center gap-1">
                  <img
                    alt="Warning"
                    className="w-4 h-4"
                    src="/icons/warningCircle.png"
                  />
                  <p className="text-xs text-[var(--color-fg-danger)]">
                    {error}
                  </p>
                </div>
              )}
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
                aria-invalid={!!error}
                aria-describedby={error ? "groupName-error" : undefined}
              />
              {newGroupName.length > 49 && (
                <p className="text-xs text-gray-500">
                  {newGroupName.length}/50 characters
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="groupDescription"
                className="text-xs font-semibold"
              >
                Description <span>(optional)</span>
              </label>
              <Textarea
                id="groupDescription"
                placeholder="Enter tool group description"
                value={newGroupDescription}
                onChange={(e) => onGroupDescriptionChange?.(e.target.value)}
                rows={3}
                maxLength={200}
                className="bg-white"
              />
              {newGroupDescription.length > 190 && (
                <p className="text-xs text-gray-500">
                  {newGroupDescription.length}/200 characters
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-300 pt-6 px-6 pb-6 bg-white">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isCreating}
            className="text-gray-700 hover:text-[var(--component-colours-color-fg-interactive-hover)]"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={
              !newGroupName.trim() || isCreating || selectedToolsCount === 0
            }
            className="bg-[#4F33CC] hover:bg-[#4F33CC]/90 text-white"
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
