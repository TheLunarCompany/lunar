import { LetterAvatar } from "@/components/LetterAvatar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { routes } from "@/routes";
import { useSocketStore, type SocketStore } from "@/store";
import type { Skill } from "@mcpx/shared-model";
import {
  Clock,
  Download,
  MoreVertical,
  Pencil,
  Trash2,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import { SkillCardMetrics } from "./SkillCardMetrics";
import {
  SkillMoreProviders,
  SkillProviderBadge,
  SkillProviderBadges,
} from "./SkillProviderBadge";

const MAX_VISIBLE_PROVIDER_BADGES = 5;
const skillUpdatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type SkillCardProps = {
  skill: Skill;
  onDelete: (id: string) => void;
  providers?: string[];
  toolsCount: number;
  promptsCount: number;
  className?: string;
};

export function SkillCard({
  skill,
  onDelete,
  providers = [],
  toolsCount,
  promptsCount,
  className,
}: SkillCardProps) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  const detailHref = generatePath(routes.skillDetail, { id: skill.id });
  const editHref = generatePath(routes.skillEditor, { id: skill.id });
  const providerBadges = providers.map((name) => ({
    name,
    isMissingOrInactive: isProviderMissingOrInactive({
      providerName: name,
      systemState,
      appConfig,
    }),
  }));
  const visibleProviderBadges = getVisibleProviderBadges(providerBadges);
  const hiddenProvidersCount = providers.length - visibleProviderBadges.length;
  function handleDownload(event: Event) {
    event.stopPropagation();
    downloadSkillMarkdown(skill);
  }

  return (
    <>
      <Card
        role="article"
        size="sm"
        onClick={() => navigate(detailHref)}
        className={cn(
          "group relative flex min-h-40 cursor-pointer flex-col gap-0 rounded-xl border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container)] p-4 shadow-sm ring-0 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
          className,
        )}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            type="button"
            aria-label={`Open skill actions for ${skill.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(true);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className={buttonVariants({
              variant: "ghost",
              size: "icon-sm",
              className:
                "absolute right-2 top-2 text-[var(--text-colours-color-text-secondary)] hover:bg-[var(--structure-color-bg-container-overlay)]",
            })}
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-36"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate(editHref)}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDownload}>
                <Download />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <TooltipProvider delayDuration={500}>
          {/* Top: icon + name */}
          <div className="flex items-center gap-3 pr-10">
            <LetterAvatar name={skill.name} />
            <div className="min-w-0 flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="truncate text-sm font-semibold leading-5 text-[var(--text-colours-color-text-primary)]">
                    {skill.name}
                  </h3>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={4}
                  className="max-w-sm whitespace-normal"
                >
                  {skill.name}
                </TooltipContent>
              </Tooltip>
              <p className="mt-0.5 truncate text-[12px] leading-4 text-[var(--text-colours-color-text-tertiary)]">
                by {skill.author.displayName}
              </p>
            </div>
          </div>

          {/* Description */}
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="line-clamp-2 min-h-[40px] text-sm text-[var(--text-colours-color-text-secondary)]">
                {skill.description}
              </p>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={4}
              className="max-w-sm whitespace-normal"
            >
              {skill.description}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* MCP servers */}
        <div className="h-[86px] overflow-hidden">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--colors-gray-600)]">
            MCP Servers
          </p>
          {providers.length > 0 ? (
            <SkillProviderBadges className="min-w-0">
              {visibleProviderBadges.map(({ name, isMissingOrInactive }) => (
                <SkillProviderBadge
                  key={name}
                  name={name}
                  isMissingOrInactive={isMissingOrInactive}
                />
              ))}
              {hiddenProvidersCount > 0 ? (
                <SkillMoreProviders
                  count={hiddenProvidersCount}
                  className="shrink-0"
                />
              ) : null}
            </SkillProviderBadges>
          ) : (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--colors-gray-500)]">
              <Unplug className="size-3.5" />
              No capabilities linked yet
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--structure-color-border-primary)] pt-3">
          <SkillCardMetrics
            toolsCount={toolsCount}
            promptsCount={promptsCount}
          />
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-colours-color-text-tertiary)]">
            <Clock className="size-3" />
            {skillUpdatedAtFormatter.format(skill.updatedAt)}
          </span>
        </div>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete skill</DialogTitle>
            <DialogDescription>
              This permanently deletes {skill.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className={buttonVariants({ variant: "outline" })}
              type="button"
            >
              Cancel
            </DialogClose>
            <DialogClose
              className={buttonVariants({ variant: "destructive" })}
              type="button"
              onClick={() => onDelete(skill.id)}
            >
              Delete skill
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function isProviderMissingOrInactive({
  providerName,
  systemState,
  appConfig,
}: {
  providerName: string;
  systemState: SocketStore["systemState"];
  appConfig: SocketStore["appConfig"];
}) {
  const isMissing = systemState
    ? !systemState.targetServers?.some((server) => server.name === providerName)
    : false;
  const isInactive =
    appConfig?.targetServerAttributes?.[providerName]?.inactive === true;

  return isMissing || isInactive;
}

function getVisibleProviderBadges(
  providers: Array<{ name: string; isMissingOrInactive: boolean }>,
) {
  let visibleActiveCount = 0;

  return providers.filter((provider) => {
    if (provider.isMissingOrInactive) {
      return true;
    }

    if (visibleActiveCount < MAX_VISIBLE_PROVIDER_BADGES) {
      visibleActiveCount += 1;
      return true;
    }

    return false;
  });
}

function downloadSkillMarkdown(skill: Skill) {
  const blob = new Blob([formatSkillMarkdown(skill)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "SKILL.md";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function formatSkillMarkdown(skill: Skill) {
  return [
    "---",
    `name: ${formatYamlString(skill.name)}`,
    `description: ${formatYamlString(skill.description)}`,
    "---",
    "",
    skill.body.trim(),
    "",
  ].join("\n");
}

function formatYamlString(value: string) {
  return JSON.stringify(value);
}
