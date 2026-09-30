import { Button } from "@/components/ui/button";

type AddMcpServersSelectionBarProps = {
  selectedCount: number;
  hasAvailableServers: boolean;
  onAdd: () => void;
  isAdding?: boolean;
};

export function AddMcpServersSelectionBar({
  selectedCount,
  hasAvailableServers,
  onAdd,
  isAdding = false,
}: AddMcpServersSelectionBarProps) {
  if (!hasAvailableServers) return null;

  const hasSelection = selectedCount > 0;
  const label =
    selectedCount === 0
      ? "No Servers selected"
      : `${selectedCount} Server${selectedCount === 1 ? "" : "s"} selected`;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-2xl border-2 border-mcpx-border-subtle bg-mcpx-surface px-4 py-3 shadow-[var(--mcpx-shadow-strong)] backdrop-blur-[25px]"
      role="region"
      aria-label="Server selection summary"
    >
      <span className="text-sm font-medium">{label}</span>

      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={onAdd}
        disabled={!hasSelection || isAdding}
      >
        {isAdding ? "Adding..." : "Add"}
      </Button>
    </div>
  );
}
