import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useDeleteSavedSetup,
  useGetSavedSetups,
  useOverwriteSavedSetup,
  useRestoreSavedSetup,
  useSaveSetup,
} from "@/data/saved-setups";
import type { SavedSetupItem } from "@mcpx/shared-model";
import { formatDistanceToNow } from "date-fns";
import {
  MonitorCog,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  Trash2,
  Wrench,
} from "lucide-react";
import { SavedSetupSheet } from "@/components/saved-setups/SavedSetupSheet";
import { EllipsisActions } from "@/components/ui/ellipsis-action";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useSocketStore } from "@/store";

type PendingAction =
  | { type: "restore"; setup: SavedSetupItem }
  | { type: "overwrite"; setup: SavedSetupItem };

type CurrentSetupSummary = {
  serverCount: number;
  toolGroupCount: number;
};

function formatCurrentSetupSummary(summary: CurrentSetupSummary): string {
  const parts: string[] = [];
  if (summary.serverCount > 0) {
    parts.push(
      `${summary.serverCount} server${summary.serverCount !== 1 ? "s" : ""}`,
    );
  }
  if (summary.toolGroupCount > 0) {
    parts.push(
      `${summary.toolGroupCount} tool group${summary.toolGroupCount !== 1 ? "s" : ""}`,
    );
  }
  return parts.length > 0 ? parts.join(" and ") : "";
}

function getActionConfig(
  action: PendingAction,
  currentSetupSummary: CurrentSetupSummary,
) {
  const summaryText = formatCurrentSetupSummary(currentSetupSummary);
  const hasCurrentSetup = summaryText.length > 0;

  switch (action.type) {
    case "restore":
      return {
        title: "Restore Setup",
        description: hasCurrentSetup
          ? `This will replace your current setup (${summaryText}) with "${action.setup.description}". Would you like to save it first?`
          : `This will replace your current setup with "${action.setup.description}". Would you like to save your current setup first?`,
        justButtonText: "Just Restore",
        justButtonTextPending: "Restoring...",
        saveButtonText: "Save & Restore",
      };
    case "overwrite":
      return {
        title: "Overwrite Setup",
        description: `This will overwrite "${action.setup.description}" with your current setup. This action cannot be undone.`,
        justButtonText: "Overwrite",
        justButtonTextPending: "Overwriting...",
        saveButtonText: null,
      };
  }
}

export default function SavedSetups() {
  const navigate = useNavigate();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [actionAfterSave, setActionAfterSave] = useState<PendingAction | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [selectedSetup, setSelectedSetup] = useState<SavedSetupItem | null>(
    null,
  );
  const toastRef = useRef<ReturnType<typeof toast> | null>(null);

  const goToDashboard = () => navigate(createPageUrl("dashboard"));

  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));
  const currentSetupSummary: CurrentSetupSummary = {
    serverCount: systemState?.targetServers?.length ?? 0,
    toolGroupCount: appConfig?.toolGroups?.length ?? 0,
  };

  const { data: savedSetups, isLoading, error } = useGetSavedSetups();
  const saveMutation = useSaveSetup();
  const restoreMutation = useRestoreSavedSetup();
  const deleteMutation = useDeleteSavedSetup();
  const overwriteMutation = useOverwriteSavedSetup();

  const isActionPending =
    restoreMutation.isPending || overwriteMutation.isPending;

  const executeAction = (action: PendingAction) => {
    switch (action.type) {
      case "restore":
        restoreMutation.mutate(action.setup.id, {
          onSuccess: () => {
            toast({
              title: "Setup restored",
              description: "Your setup has been restored",
            });
            setPendingAction(null);
            goToDashboard();
          },
          onError: () => {
            toast({
              title: "Error",
              description: "Failed to restore setup",
              variant: "destructive",
            });
          },
        });
        break;
      case "overwrite":
        overwriteMutation.mutate(action.setup.id, {
          onSuccess: () => {
            toast({
              title: "Setup overwritten",
              description: `"${action.setup.description}" has been updated with your current setup`,
            });
            setPendingAction(null);
          },
          onError: () => {
            toast({
              title: "Error",
              description: "Failed to overwrite setup",
              variant: "destructive",
            });
          },
        });
        break;
    }
  };

  const handleSave = () => {
    if (!description.trim()) return;
    saveMutation.mutate(description.trim(), {
      onSuccess: (result) => {
        if (result.success) {
          toast({
            title: "Setup saved",
            description: `Saved as "${result.description}"`,
          });
          setIsSaveDialogOpen(false);
          setDescription("");

          if (actionAfterSave) {
            const action = actionAfterSave;
            setActionAfterSave(null);
            executeAction(action);
          }
        } else {
          toast({
            title: "Failed to save",
            description: result.error,
            variant: "destructive",
          });
        }
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to save setup",
          variant: "destructive",
        });
      },
    });
  };

  const handleJustAction = () => {
    if (pendingAction) {
      executeAction(pendingAction);
    }
  };

  const handleSaveAndAction = () => {
    if (pendingAction) {
      setActionAfterSave(pendingAction);
      setPendingAction(null);
      setIsSaveDialogOpen(true);
    }
  };

  const handleDelete = (setup: SavedSetupItem) => {
    toastRef.current = toast({
      title: "Delete saved setup",
      description: (
        <>
          Are you sure you want to delete <strong>{setup.description}</strong>?
        </>
      ),
      isClosable: true,
      duration: 1000000,
      variant: "warning",
      action: (
        <Button
          variant="danger"
          onClick={() => {
            deleteMutation.mutate(setup.id, {
              onSuccess: () => {
                if (toastRef.current?.dismiss) {
                  toastRef.current.dismiss();
                  toastRef.current = null;
                }
              },
              onError: () => {
                toast({
                  title: "Error",
                  description: "Failed to delete",
                  variant: "destructive",
                });
              },
            });
          }}
        >
          Delete
        </Button>
      ),
      position: "bottom-left",
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spinner className="w-8 h-8 text-[var(--color-fg-interactive)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-[var(--color-text-danger)]">
          Failed to load saved setups
        </p>
      </div>
    );
  }

  const setups = savedSetups?.setups ?? [];
  const actionConfig = pendingAction
    ? getActionConfig(pendingAction, currentSetupSummary)
    : null;

  return (
    <div className="w-full bg-[var(--color-bg-app)]">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Saved Setups</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Save and restore your MCPX setup
            </p>
          </div>
          <Button
            onClick={() => setIsSaveDialogOpen(true)}
            className="bg-[var(--color-fg-interactive)] hover:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
          >
            <Plus className="w-4 h-4" />
            Save Current Setup
          </Button>
        </div>

        {setups.length === 0 ? (
          <div className="bg-[var(--color-bg-container)] rounded-xl border border-[var(--color-border-primary)] p-12 text-center">
            <MonitorCog className="w-12 h-12 mx-auto text-[var(--color-text-secondary)] mb-4" />
            <h3 className="text-lg font-medium mb-2">No saved setups</h3>
            <p className="text-[var(--color-text-secondary)]">
              Save your current configuration to restore it later
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {setups.map((setup: SavedSetupItem) => {
              const serverNames = Object.keys(setup.targetServers);
              const toolGroupCount = setup.config.toolGroups?.length ?? 0;
              return (
                <div
                  key={setup.id}
                  className="bg-[#F3F5FA] rounded-lg border-2 border-[#D8DCED] p-4 hover:border-[var(--color-border-interactive)] hover:shadow-md hover:shadow-[var(--color-fg-interactive)]/20 transition-all cursor-pointer min-h-[160px] flex flex-col"
                  onClick={() => setSelectedSetup(setup)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xl min-w-10 w-10 min-h-10 h-10 rounded-full flex items-center justify-center bg-white border-2 border-gray-200 flex-shrink-0">
                        <MonitorCog className="w-5 h-5 text-[var(--color-text-secondary)]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <h3 className="text-lg font-medium leading-tight truncate cursor-default">
                              {setup.description}
                            </h3>
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
                    <div onClick={(e) => e.stopPropagation()}>
                      <EllipsisActions
                        items={[
                          {
                            label: "Restore",
                            icon: <RotateCcw className="w-4 h-4" />,
                            callback: () =>
                              setPendingAction({ type: "restore", setup }),
                          },
                          {
                            label: "Overwrite",
                            icon: <RefreshCw className="w-4 h-4" />,
                            callback: () =>
                              setPendingAction({ type: "overwrite", setup }),
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="w-4 h-4" />,
                            callback: () => handleDelete(setup),
                          },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    <div className="flex flex-wrap gap-2">
                      {serverNames.slice(0, 3).map((name) => (
                        <div
                          key={name}
                          className="rounded-lg flex items-center gap-1.5 bg-white px-2 py-1 text-xs border border-gray-200"
                        >
                          <Server className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                          <span className="text-[var(--color-text-primary)] truncate max-w-[100px]">
                            {name}
                          </span>
                        </div>
                      ))}
                      {serverNames.length > 3 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="rounded-lg flex items-center gap-1 bg-white px-2 py-1 text-xs border border-gray-200 cursor-default">
                              <span className="text-[var(--color-text-secondary)]">
                                +{serverNames.length - 3} more
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <ul className="list-disc list-inside">
                              {serverNames.slice(3).map((name) => (
                                <li key={name}>{name}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {toolGroupCount > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {setup.config.toolGroups?.slice(0, 2).map((group) => (
                          <div
                            key={group.name}
                            className="rounded-lg flex items-center gap-1.5 bg-white px-2 py-1 text-xs border border-gray-200"
                          >
                            <Wrench className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                            <span className="text-[var(--color-text-primary)] truncate max-w-[100px]">
                              {group.name}
                            </span>
                          </div>
                        ))}
                        {toolGroupCount > 2 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="rounded-lg flex items-center gap-1 bg-white px-2 py-1 text-xs border border-gray-200 cursor-default">
                                <span className="text-[var(--color-text-secondary)]">
                                  +{toolGroupCount - 2} more
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <ul className="list-disc list-inside">
                                {setup.config.toolGroups
                                  ?.slice(2)
                                  .map((group) => (
                                    <li key={group.name}>{group.name}</li>
                                  ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Current Setup</DialogTitle>
              <DialogDescription>
                Give your setup a description so you can identify it later.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Production config with GitHub and Slack"
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && description.trim()) {
                    handleSave();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsSaveDialogOpen(false);
                  setDescription("");
                  setActionAfterSave(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!description.trim() || saveMutation.isPending}
                className="bg-[var(--color-fg-interactive)] hover:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
              >
                {saveMutation.isPending ? "Saving..." : "Save Setup"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SavedSetupSheet
          isOpen={selectedSetup !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedSetup(null);
          }}
          setup={selectedSetup}
          onRestore={(setup) => {
            setSelectedSetup(null);
            setPendingAction({ type: "restore", setup });
          }}
          onOverwrite={(setup) => {
            setSelectedSetup(null);
            setPendingAction({ type: "overwrite", setup });
          }}
          onDelete={(setup) => {
            setSelectedSetup(null);
            handleDelete(setup);
          }}
        />

        <Dialog
          open={pendingAction !== null}
          onOpenChange={(open) => !open && setPendingAction(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionConfig?.title}</DialogTitle>
              <DialogDescription>{actionConfig?.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                onClick={() => setPendingAction(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleJustAction}
                disabled={isActionPending}
              >
                {isActionPending
                  ? actionConfig?.justButtonTextPending
                  : actionConfig?.justButtonText}
              </Button>
              {actionConfig?.saveButtonText && (
                <Button
                  onClick={handleSaveAndAction}
                  className="bg-[var(--color-fg-interactive)] hover:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
                >
                  {actionConfig.saveButtonText}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
