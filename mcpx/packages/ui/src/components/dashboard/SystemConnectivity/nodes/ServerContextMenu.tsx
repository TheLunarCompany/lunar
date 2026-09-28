import { Info, Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ServerContextMenuProps = {
  isInactive: boolean;
  canEdit: boolean;
  top?: number | false;
  left?: number | false;
  right?: number | false;
  bottom?: number | false;
  onDetails: () => void;
  onEdit: () => void;
  onToggleInactive: () => void;
  onDelete: () => void;
  onClick: () => void;
};

export function ServerContextMenu({
  isInactive,
  canEdit,
  top,
  left,
  right,
  bottom,
  onDetails,
  onEdit,
  onToggleInactive,
  onDelete,
  onClick,
}: ServerContextMenuProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: top || undefined,
        left: left || undefined,
        right: right || undefined,
        bottom: bottom || undefined,
        zIndex: 100,
      }}
      className="flex flex-col rounded-lg border border-[var(--mcpx-border-subtle)] bg-mcpx-surface py-1 shadow-lg"
      onClick={onClick}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onDetails}
        className="justify-start gap-2 rounded-none px-2.5"
      >
        <Info className="size-4 text-[var(--mcpx-text-tertiary)]" />
        Details
      </Button>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="justify-start gap-2 rounded-none px-2.5"
        >
          <Pencil className="size-4 text-[var(--mcpx-text-tertiary)]" />
          Edit
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleInactive}
        className={
          isInactive
            ? "justify-start gap-2 rounded-none px-2.5 text-mcpx-success-text hover:text-mcpx-success-text"
            : "justify-start gap-2 rounded-none px-2.5"
        }
      >
        <Power
          className={
            isInactive
              ? "size-4 text-mcpx-success-text"
              : "size-4 text-[var(--mcpx-text-tertiary)]"
          }
        />
        {isInactive ? "Activate" : "Deactivate"}
      </Button>
      <div className="mx-2 my-0.5 border-t border-[var(--mcpx-border-subtle)]" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="justify-start gap-2 rounded-none px-2.5 text-mcpx-danger-text hover:text-mcpx-danger-text"
      >
        <Trash2 className="size-4" />
        Delete
      </Button>
    </div>
  );
}
