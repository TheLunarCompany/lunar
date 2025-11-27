import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectionPanelProps {
  selectedTools: Set<string>;
  editingGroup: any;
  isAddCustomToolMode: boolean;
  originalSelectedTools: Set<string>;
  isSavingGroupChanges: boolean;
  areSetsEqual: (set1: Set<string>, set2: Set<string>) => boolean;
  showCreateModal?: boolean;
  onSaveGroupChanges: () => void;
  onClearSelection: () => void;
  onCreateToolGroup: () => void;
  onCustomizeSelectedTool?: () => void;
}

export function SelectionPanel({
  selectedTools,
  editingGroup,
  isAddCustomToolMode,
  originalSelectedTools,
  isSavingGroupChanges,
  areSetsEqual,
  showCreateModal = false,
  onSaveGroupChanges,
  onClearSelection,
  onCreateToolGroup,
  onCustomizeSelectedTool,
}: SelectionPanelProps) {
  if (selectedTools.size === 0 || showCreateModal) {
    return null;
  }

  if (isAddCustomToolMode) {
    return (
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <span className="bg-[#4F33CC] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium">
                {selectedTools.size}
              </span>
              <span className="text-sm text-gray-700 font-medium">
                Tool{selectedTools.size !== 1 ? "s" : ""} selected
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onCustomizeSelectedTool}
              disabled={!onCustomizeSelectedTool}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-button-primary hover:enabled:bg-button-hover border-button-primary fill-primary-foreground text-primary-foreground shadow r h-9 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Customize
            </Button>
            <Button
              onClick={onClearSelection}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-button-primary hover:enabled:bg-button-hover border-button-primary fill-primary-foreground text-primary-foreground shadow r h-9 px-2 py-2 font-medium transition-colors text-sm hover:bg-gray-50"
              title="Clear all selected tools"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (editingGroup && areSetsEqual(selectedTools, originalSelectedTools)) {
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
              Tool{selectedTools.size !== 1 ? "s" : ""} selected
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
                className="px-2 py-2 font-medium transition-colors text-sm hover:bg-gray-50"
                title="Clear all selected tools"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onCreateToolGroup}
                className="px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
              <Button
                onClick={onClearSelection}
                className="px-2 py-2 font-medium transition-colors text-sm hover:bg-gray-50"
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
