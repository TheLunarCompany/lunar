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
import {
  Eye,
  Hammer,
  MonitorCog,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { SavedSetupSheet } from "@/components/saved-setups/SavedSetupSheet";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { EllipsisActions } from "@/components/ui/ellipsis-action";
import { Separator } from "@/components/ui/separator";
import { routes } from "@/routes";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTimeLong } from "@/utils";
import { useSocketStore } from "@/store";
import { pluralizeWithCount } from "@mcpx/toolkit-ui/src/utils/string-utils";
import { isSkillsPageEnabled } from "@/config/runtime-config";
import { useSkills } from "@/data/skills";

type PendingAction =
  | { type: "restore"; setup: SavedSetupItem }
  | { type: "overwrite"; setup: SavedSetupItem };

type CurrentSetupSummary = {
  serverCount: number;
  toolGroupCount: number;
  skillCount: number;
};

function formatCurrentSetupSummary(
  summary: CurrentSetupSummary,
  skillsPageEnabled: boolean,
): string {
  const parts: string[] = [];
  if (summary.serverCount > 0) {
    parts.push(`${pluralizeWithCount(summary.serverCount, "server")}`);
  }
  if (skillsPageEnabled && summary.skillCount > 0) {
    parts.push(`${pluralizeWithCount(summary.skillCount, "skill")}`);
  } else if (!skillsPageEnabled && summary.toolGroupCount > 0) {
    parts.push(`${pluralizeWithCount(summary.toolGroupCount, "tool group")}`);
  }
  return parts.length > 0 ? parts.join(" and ") : "";
}

function ServerIconCell({ name }: { name: string }) {
  const domainIconUrl = useDomainIcon(name);
  return (
    <img
      src={domainIconUrl}
      alt=""
      className="w-4 h-4 rounded-[2px] object-contain shrink-0"
    />
  );
}

function getActionConfig(
  action: PendingAction,
  currentSetupSummary: CurrentSetupSummary,
  skillsPageEnabled: boolean,
) {
  const summaryText = formatCurrentSetupSummary(
    currentSetupSummary,
    skillsPageEnabled,
  );
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
  const skillsPageEnabled = isSkillsPageEnabled();
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

  const goToDashboard = () => navigate(routes.dashboard);

  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));
  const currentSetupSummary: CurrentSetupSummary = {
    serverCount: systemState?.targetServers?.length ?? 0,
    toolGroupCount: appConfig?.toolGroups?.length ?? 0,
    skillCount: new Set(
      appConfig?.skills?.enabled.flatMap((entry) => entry.skillIds) ?? [],
    ).size,
  };

  const { data: savedSetups, isLoading, error } = useGetSavedSetups();
  const skillsQuery = useSkills({ enabled: skillsPageEnabled });
  const skillsById = useMemo(
    () => new Map((skillsQuery.data ?? []).map((skill) => [skill.id, skill])),
    [skillsQuery.data],
  );
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
          variant="destructive"
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
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-(--color-text-danger)">
          Failed to load saved setups
        </p>
      </div>
    );
  }

  const setups = savedSetups?.setups ?? [];
  const actionConfig = pendingAction
    ? getActionConfig(pendingAction, currentSetupSummary, skillsPageEnabled)
    : null;

  return (
    <div className="w-full p-6">
      <div className="flex items-start justify-between">
        <div className="text-[20px] font-semibold mb-3">Saved Setups</div>
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => setIsSaveDialogOpen(true)}
            className="bg-primary hover:bg-primary/80 text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
            Save Current Setup
          </Button>
        </div>
      </div>

      <div className="flex flex-col">
        {setups.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <MonitorCog className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No saved setups</h3>
            <p className="text-muted-foreground">
              Save your current configuration to restore it later
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {setups.map((setup: SavedSetupItem) => {
              const serverNames = Object.keys(setup.targetServers).sort();
              const toolGroupNames =
                setup.config.toolGroups?.map((group) => group.name).sort() ??
                [];
              const skillIds = [
                ...new Set(
                  setup.config.skills?.enabled.flatMap(
                    (entry) => entry.skillIds,
                  ) ?? [],
                ),
              ];
              const skillLabels = skillIds.map((id) => ({
                id,
                label: skillsById.get(id)?.name ?? id,
                unavailable: !skillsQuery.isLoading && !skillsById.has(id),
              }));
              return (
                <div
                  key={setup.id}
                  className="bg-white rounded-lg border-2 border-[#D8DCED] p-4 hover:border-primary! hover:shadow-md hover:shadow-primary/30 transition-all duration-200 cursor-pointer min-h-[160px] flex flex-col"
                  onClick={() => setSelectedSetup(setup)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
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
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <EllipsisActions
                        items={[
                          {
                            label: "Details",
                            icon: <Eye className="w-4 h-4" />,
                            callback: () => setSelectedSetup(setup),
                          },
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

                  <p className="text-[11px] mb-1 font-bold">SERVERS</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {serverNames.slice(0, 3).map((name) => (
                      <div
                        key={name}
                        className="rounded-[4px] flex items-center gap-1 bg-white px-1 py-1 text-xs border border-[#D8DCED]"
                      >
                        <ServerIconCell name={name} />
                        <span className="text-foreground truncate max-w-[100px]">
                          {name}
                        </span>
                      </div>
                    ))}
                    {serverNames.length > 3 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px]">
                            +{serverNames.length - 3}
                          </span>
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
                  {skillsPageEnabled && skillLabels.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-[11px] mb-1 font-bold">SKILLS</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        {skillLabels.slice(0, 3).map((skill) => (
                          <div
                            key={skill.id}
                            className={`rounded-[4px] flex items-center gap-1 bg-white px-1 py-1 text-xs border border-[#D8DCED] ${
                              skill.unavailable ? "text-muted-foreground" : ""
                            }`}
                            title={
                              skill.unavailable
                                ? "Skill is no longer available"
                                : undefined
                            }
                          >
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate max-w-[100px]">
                              {skill.label}
                            </span>
                          </div>
                        ))}
                        {skillLabels.length > 3 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[11px]">
                                +{skillLabels.length - 3}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <ul className="list-disc list-inside">
                                {skillLabels.slice(3).map((skill) => (
                                  <li key={skill.id}>{skill.label}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ) : !skillsPageEnabled && toolGroupNames.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-[11px] mb-1 font-bold">TOOL GROUPS</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        {toolGroupNames.slice(0, 3).map((groupName) => (
                          <div
                            key={groupName}
                            className="rounded-[4px] flex items-center gap-1 bg-white px-1 py-1 text-xs border border-[#D8DCED]"
                          >
                            <Hammer className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground truncate max-w-[100px]">
                              {groupName}
                            </span>
                          </div>
                        ))}
                        {toolGroupNames.length > 3 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[11px]">
                                +{toolGroupNames.length - 3}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <ul className="list-disc list-inside">
                                {toolGroupNames.slice(3).map((groupName) => (
                                  <li key={groupName}>{groupName}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-auto flex flex-col gap-2">
                    <Separator className="mb-2 mt-4" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[12px] text-muted-foreground cursor-default">
                          Created at: {formatDateTimeLong(setup.savedAt)}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {formatDateTimeLong(setup.savedAt)}
                      </TooltipContent>
                    </Tooltip>
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
                className="bg-primary hover:bg-primary/80 text-primary-foreground"
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
                variant="destructive"
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
                  className="bg-primary hover:bg-primary/80 text-primary-foreground"
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
