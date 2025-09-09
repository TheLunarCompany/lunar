import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectionPanelProps {
  selectedTools: Set<string>;
  editingGroup: any;
  originalSelectedTools: Set<string>;
  isSavingGroupChanges: boolean;
  areSetsEqual: (set1: Set<string>, set2: Set<string>) => boolean;
  onSaveGroupChanges: () => void;
  onClearSelection: () => void;
  onCreateToolGroup: () => void;
}

export function SelectionPanel({
  selectedTools,
  editingGroup,
  originalSelectedTools,
  isSavingGroupChanges,
  areSetsEqual,
  onSaveGroupChanges,
  onClearSelection,
  onCreateToolGroup
}: SelectionPanelProps) {
  if (selectedTools.size === 0 || (editingGroup && areSetsEqual(selectedTools, originalSelectedTools))) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <span className="bg-[#4F33CC] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium">
              {selectedTools.size}
            </span>
            <span className="text-sm text-gray-700 font-medium">
              Tool{selectedTools.size !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editingGroup ? (
            <>
              <Button
                onClick={onSaveGroupChanges}
                disabled={isSavingGroupChanges}
                className="bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-[#4F33CC] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingGroupChanges ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={onClearSelection}
                variant="ghost"
                className="text-gray-700 px-2 py-2 font-medium transition-colors text-sm hover:bg-gray-50"
                title="Clear all selected tools"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onCreateToolGroup}
                className="bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-[#4F33CC]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
              <Button
                onClick={onClearSelection}
                variant="ghost"
                className="text-gray-700 px-2 py-2 font-medium transition-colors text-sm hover:bg-gray-50"
                title="Clear all selected tools"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
