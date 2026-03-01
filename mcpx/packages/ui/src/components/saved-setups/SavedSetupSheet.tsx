import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  VisuallyHidden,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MonitorCog,
  RotateCcw,
  RefreshCw,
  Trash2,
  Server,
  Wrench,
} from "lucide-react";
import type { SavedSetupItem } from "@mcpx/shared-model";
import { formatDistanceToNow } from "date-fns";

interface SavedSetupSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  setup: SavedSetupItem | null;
  onRestore: (setup: SavedSetupItem) => void;
  onOverwrite: (setup: SavedSetupItem) => void;
  onDelete: (setup: SavedSetupItem) => void;
}

export function SavedSetupSheet({
  isOpen,
  onOpenChange,
  setup,
  onRestore,
  onOverwrite,
  onDelete,
}: SavedSetupSheetProps) {
  if (!setup) return null;

  const serverNames = Object.keys(setup.targetServers);
  const toolGroups = setup.config.toolGroups ?? [];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden gap-0 overflow-x-hidden border-l-2 border-[var(--component-colours-color-fg-interactive)]"
        style={{
          overflowX: "hidden",
          boxShadow: "-4px 0 60px 0 rgba(0, 0, 0, 0.25)",
        }}
      >
        <VisuallyHidden>
          <SheetTitle>{setup.description}</SheetTitle>
        </VisuallyHidden>
        <SheetHeader className="px-6">
          <div className="flex items-center justify-between mt-6 gap-2 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-xl min-w-10 w-10 min-h-10 h-10 rounded-full flex items-center justify-center bg-[#F3F5FA] border-2 border-gray-200 flex-shrink-0">
                <MonitorCog className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </span>
              <div className="min-w-0 flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="text-xl font-semibold text-gray-900 truncate"
                      style={{ fontWeight: 600 }}
                    >
                      {setup.description}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {setup.description}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-[var(--color-text-secondary)] cursor-default">
                      {formatDistanceToNow(new Date(setup.savedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {new Date(setup.savedAt).toLocaleString()}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRestore(setup)}
                    className="p-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Restore</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOverwrite(setup)}
                    className="p-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Overwrite with current setup
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(setup)}
                    className="p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Delete</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <SheetDescription></SheetDescription>
        </SheetHeader>

        <div className="px-6 py-2 space-y-4 overflow-y-auto">
          {serverNames.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white shadow-sm">
              <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                <Server className="w-4 h-4 text-[var(--color-text-secondary)]" />
                Servers
              </h3>
              <div className="space-y-2">
                {serverNames.map((name) => (
                  <div
                    key={name}
                    className="flex items-center rounded-lg p-3"
                    style={{
                      backgroundColor: "white",
                      border: "1px solid #E2E2E2",
                    }}
                  >
                    <p
                      className="text-[var(--text-colours-color-text-primary)]"
                      style={{ fontWeight: 600 }}
                    >
                      {name}
                    </p>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500">
                {serverNames.length} server
                {serverNames.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {toolGroups.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white shadow-sm">
              <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[var(--color-text-secondary)]" />
                Tool Groups
              </h3>
              <div className="space-y-2">
                {toolGroups.map((group) => {
                  const serviceNames = Object.keys(group.services);
                  const totalTools = Object.values(group.services).reduce(
                    (sum, tools) => sum + tools.length,
                    0,
                  );
                  return (
                    <div
                      key={group.name}
                      className="flex flex-col gap-1 rounded-lg p-3"
                      style={{
                        backgroundColor: "white",
                        border: "1px solid #E2E2E2",
                      }}
                    >
                      <p
                        className="text-[var(--text-colours-color-text-primary)]"
                        style={{ fontWeight: 600 }}
                      >
                        {group.name}
                      </p>
                      {group.description && (
                        <p className="text-sm text-gray-500">
                          {group.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {serviceNames.length} server
                        {serviceNames.length !== 1 ? "s" : ""} · {totalTools}{" "}
                        tool
                        {totalTools !== 1 ? "s" : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500">
                {toolGroups.length} tool group
                {toolGroups.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {serverNames.length === 0 && toolGroups.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-500 text-sm">This setup is empty</div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
