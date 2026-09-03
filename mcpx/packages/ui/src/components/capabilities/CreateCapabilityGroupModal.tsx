import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";

type CreateCapabilityGroupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedItemCount: number;
  error?: string | null;
  isCreating?: boolean;
  onSubmitCapabilityGroup: (draft: {
    name: string;
    description: string;
  }) => void | Promise<void | boolean>;
};

export function CreateCapabilityGroupModal({
  isOpen,
  onClose,
  selectedItemCount,
  error,
  isCreating = false,
  onSubmitCapabilityGroup,
}: CreateCapabilityGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setLocalError(null);
    }
  }, [isOpen]);

  async function handleSubmit() {
    if (!name.trim()) {
      setLocalError("Group name cannot be empty");
      return;
    }

    if (selectedItemCount === 0) {
      setLocalError("Select at least one tool before creating a group.");
      return;
    }

    setLocalError(null);
    await onSubmitCapabilityGroup({ name, description });
  }

  const visibleError = localError ?? error;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] w-[90vw] overflow-x-hidden rounded-lg border border-[var(--colors-gray-200)] bg-white p-0 sm:max-w-[600px]"
        showCloseButton={false}
      >
        <div className="border-b border-[var(--colors-gray-200)] px-6 py-6">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Create Capability Group
          </DialogTitle>
          <DialogDescription className="mt-2">
            Create a new tool group with the selected tools.
          </DialogDescription>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-3">
            <label
              htmlFor="capability-group-name"
              className="text-sm font-semibold"
            >
              Group Name
            </label>
            {visibleError && (
              <p className="text-xs text-destructive">{visibleError}</p>
            )}
            <Input
              id="capability-group-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setLocalError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSubmit();
                }
              }}
              placeholder="Enter tool group name"
              maxLength={50}
              autoFocus
              aria-invalid={!!visibleError}
            />
          </div>

          <div className="space-y-3">
            <label
              htmlFor="capability-group-description"
              className="text-sm font-semibold"
            >
              Description{" "}
              <span className="text-xs font-normal">(optional)</span>
            </label>
            <Textarea
              id="capability-group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Enter tool group description"
              rows={3}
              maxLength={200}
              className="bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--colors-gray-200)] bg-white px-6 py-6">
          <Button variant="ghost" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-white" />
                Creating...
              </span>
            ) : (
              "Create Group"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
