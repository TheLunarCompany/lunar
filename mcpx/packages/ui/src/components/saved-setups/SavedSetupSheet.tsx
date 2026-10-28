import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden as VisuallyHiddenPrimitive } from "radix-ui";
const VisuallyHidden = VisuallyHiddenPrimitive.Root;
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
  Sparkles,
  Wrench,
} from "lucide-react";
import type { SavedSetupItem } from "@mcpx/shared-model";
import { formatDistanceToNow } from "date-fns";
import { pluralizeWithCount } from "@mcpx/toolkit-ui/src/utils/string-utils";
import { useSkillsFeatureEnabled } from "@/data/skills";
import { useSkills } from "@/data/skills";
import { useGetMCPServers } from "@/data/catalog-servers";
import { buildSkillCardCapabilitySummaryResolver } from "@/mapping/skills";
import { useSocketStore } from "@/store";
import { useMemo, useRef } from "react";

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
  const titleRef = useRef<HTMLHeadingElement>(null);
  const skillsFeatureEnabled = useSkillsFeatureEnabled().data ?? false;
  const skillsQuery = useSkills({
    enabled: skillsFeatureEnabled && setup !== null,
  });
  const catalogServersQuery = useGetMCPServers({
    enabled: skillsFeatureEnabled && setup !== null,
  });
  const systemState = useSocketStore((state) => state.systemState);
  const summarizeCapabilities = useMemo(
    () =>
      buildSkillCardCapabilitySummaryResolver(
        systemState,
        catalogServersQuery.data,
      ),
    [catalogServersQuery.data, systemState],
  );

  if (!setup) return null;

  const serverNames = Object.keys(setup.targetServers).sort();
  const toolGroups = setup.config.toolGroups ?? [];
  const skillIds = [
    ...new Set(
      setup.config.skills?.enabled.flatMap((entry) => entry.skillIds) ?? [],
    ),
  ];
  const skillsById = new Map(
    (skillsQuery.data ?? []).map((skill) => [skill.id, skill]),
  );
  const savedSkills = skillIds.map((id) => {
    const skill = skillsById.get(id);
    return {
      id,
      skill,
      summary: summarizeCapabilities(skill?.capabilityGroup),
    };
  });

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        className="flex w-[600px] max-w-[600px]! flex-col gap-0 overflow-x-hidden border-l-2 border-primary bg-mcpx-surface p-0 [&>button]:hidden"
        style={{
          overflowX: "hidden",
          boxShadow: "-4px 0 60px 0 var(--mcpx-shadow-strong)",
        }}
      >
        <VisuallyHidden>
          <SheetTitle>{setup.description}</SheetTitle>
        </VisuallyHidden>
        <SheetHeader className="px-6">
          <div className="flex items-center justify-between mt-6 gap-2 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-mcpx-border-subtle bg-mcpx-surface-tertiary text-xl">
                <MonitorCog className="w-5 h-5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  ref={titleRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-mcpx-text"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block w-fit max-w-full truncate">
                        {setup.description}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {setup.description}
                    </TooltipContent>
                  </Tooltip>
                </h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="w-fit cursor-default text-xs text-muted-foreground">
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
                    size="icon-sm"
                    onClick={() => onRestore(setup)}
                    aria-label="Restore"
                  >
                    <RotateCcw />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Restore</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onOverwrite(setup)}
                    aria-label="Overwrite with current setup"
                  >
                    <RefreshCw />
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
                    size="icon-sm"
                    onClick={() => onDelete(setup)}
                    aria-label="Delete"
                  >
                    <Trash2 />
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
            <div className="space-y-3 rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-4 shadow-[var(--mcpx-shadow-weak)]">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-mcpx-text">
                <Server className="w-4 h-4 text-muted-foreground" />
                Servers
              </h3>
              <div className="space-y-2">
                {serverNames.map((name) => (
                  <div
                    key={name}
                    className="flex items-center rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-3"
                  >
                    <p className="text-foreground" style={{ fontWeight: 600 }}>
                      {name}
                    </p>
                  </div>
                ))}
              </div>
              <div className="text-xs text-mcpx-text-secondary">
                {pluralizeWithCount(serverNames.length, "server")}
              </div>
            </div>
          )}

          {skillsFeatureEnabled && savedSkills.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-4 shadow-[var(--mcpx-shadow-weak)]">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-mcpx-text">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                Skills
              </h3>
              <div className="space-y-2">
                {savedSkills.map(({ id, skill, summary }) => (
                  <div
                    key={id}
                    className="flex flex-col gap-1 rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-3"
                  >
                    <p className="font-semibold text-foreground">
                      {skill?.name ?? id}
                    </p>
                    <p className="text-sm text-mcpx-text-secondary">
                      {skill?.description ??
                        (skillsQuery.isLoading
                          ? "Loading skill details..."
                          : "Skill is no longer available.")}
                    </p>
                    {skill ? (
                      <p className="text-xs text-mcpx-text-tertiary">
                        {pluralizeWithCount(summary.providers.length, "server")}{" "}
                        · {pluralizeWithCount(summary.toolsCount, "tool")}
                        {summary.promptsCount > 0
                          ? ` · ${pluralizeWithCount(
                              summary.promptsCount,
                              "prompt",
                            )}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="text-xs text-mcpx-text-secondary">
                {pluralizeWithCount(savedSkills.length, "skill")} selected
              </div>
            </div>
          ) : !skillsFeatureEnabled && toolGroups.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-4 shadow-[var(--mcpx-shadow-weak)]">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-mcpx-text">
                <Wrench className="w-4 h-4 text-muted-foreground" />
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
                      className="flex flex-col gap-1 rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-3"
                    >
                      <p
                        className="text-foreground"
                        style={{ fontWeight: 600 }}
                      >
                        {group.name}
                      </p>
                      {group.description && (
                        <p className="text-sm text-mcpx-text-secondary">
                          {group.description}
                        </p>
                      )}
                      <p className="text-xs text-mcpx-text-tertiary">
                        {pluralizeWithCount(serviceNames.length, "server")} ·{" "}
                        {pluralizeWithCount(totalTools, "tool")}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-mcpx-text-secondary">
                {pluralizeWithCount(toolGroups.length, "tool group")} selected
              </div>
            </div>
          ) : null}

          {serverNames.length === 0 &&
            (skillsFeatureEnabled
              ? savedSkills.length === 0
              : toolGroups.length === 0) && (
              <div className="text-center py-8">
                <div className="text-sm text-mcpx-text-secondary">
                  This setup is empty
                </div>
              </div>
            )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
