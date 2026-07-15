import { Button } from "@/components/ui/button";

type AddMcpServersSelectionBarProps = {
  selectedCount: number;
  onAdd: () => void;
  isAdding?: boolean;
};

export function AddMcpServersSelectionBar({
  selectedCount,
  onAdd,
  isAdding = false,
}: AddMcpServersSelectionBarProps) {
  const hasSelection = selectedCount > 0;
  const label =
    selectedCount === 0
      ? "No Servers selected"
      : `${selectedCount} Server${selectedCount === 1 ? "" : "s"} selected`;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 shadow-[0_8px_16px_0_rgba(0,0,0,0.25)] backdrop-blur-[25px]"
      role="region"
      aria-label="Server selection summary"
    >
      <span className="text-sm font-medium">{label}</span>

      <Button
        type="button"
        size="sm"
        onClick={onAdd}
        disabled={!hasSelection || isAdding}
        className={
          hasSelection
            ? "rounded-lg bg-lunar-purpleNew px-4 py-1 text-white hover:bg-lunar-purpleNew/90"
            : "cursor-not-allowed rounded-lg bg-gray-200 px-4 text-gray-500"
        }
      >
        {isAdding ? "Adding..." : "Add"}
      </Button>
    </div>
  );
}
