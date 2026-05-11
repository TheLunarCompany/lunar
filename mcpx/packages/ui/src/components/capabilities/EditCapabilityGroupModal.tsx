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
import type { CapabilityGroup } from "./types";

type EditCapabilityGroupModalProps = {
  isOpen: boolean;
  group: CapabilityGroup | null;
  onClose: () => void;
  error?: string | null;
  isSaving?: boolean;
  onSubmitCapabilityGroup: (draft: {
    name: string;
    description: string;
  }) => void | Promise<void | boolean>;
};

export function EditCapabilityGroupModal({
  isOpen,
  group,
  onClose,
  error,
  isSaving = false,
  onSubmitCapabilityGroup,
}: EditCapabilityGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen && group) {
      setName(group.name);
      setDescription(group.description);
    }
  }, [group, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-lg border border-[var(--colors-gray-200)] bg-white">
        <DialogTitle>Update Group</DialogTitle>
        <DialogDescription className="text-foreground">
          Update the tool group name and description.
        </DialogDescription>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="edit-capability-group-name"
              className="text-sm font-medium"
            >
              Group Name
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Input
              id="edit-capability-group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter tool group name"
              maxLength={50}
              autoFocus
              aria-invalid={!!error}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="edit-capability-group-description"
              className="text-sm font-medium"
            >
              Description{" "}
              <span className="text-xs font-normal">(optional)</span>
            </label>
            <Textarea
              id="edit-capability-group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Enter tool group description"
              rows={2}
              maxLength={200}
              className="bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--colors-gray-200)] pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmitCapabilityGroup({ name, description })}
            disabled={!name.trim() || isSaving || !group}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-white" />
                Updating...
              </span>
            ) : (
              "Update Group"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
