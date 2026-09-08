import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { CapabilityGroup, CapabilitySelectionKey } from "./types";

type CapabilitySelectionPanelProps = {
  selectedCapabilityKeys: Set<CapabilitySelectionKey>;
  editingGroup?: CapabilityGroup | null;
  isSaving?: boolean;
  onSaveGroupChanges: () => void;
  onClearSelection: () => void;
  onCreateGroup: () => void;
};

export function CapabilitySelectionPanel({
  selectedCapabilityKeys,
  editingGroup = null,
  isSaving = false,
  onSaveGroupChanges,
  onClearSelection,
  onCreateGroup,
}: CapabilitySelectionPanelProps) {
  if (selectedCapabilityKeys.size === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--colors-gray-200)] bg-white p-4 shadow-lg">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {selectedCapabilityKeys.size}
          </span>
          <span className="text-sm font-medium text-[var(--colors-gray-700)]">
            Tool{selectedCapabilityKeys.size === 1 ? "" : "s"} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {editingGroup ? (
            <Button onClick={onSaveGroupChanges} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          ) : (
            <Button onClick={onCreateGroup}>
              <Plus className="size-4" />
              Create
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            title="Clear all selected tools"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
