import { LetterAvatar } from "@/components/LetterAvatar";
import { McpServerBadge, McpServerBadges } from "@/components/McpServerBadge";
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
import { useNavigate } from "react-router-dom";
import { SkillCardMetrics } from "./SkillCardMetrics";

const MAX_VISIBLE_PROVIDER_BADGES = 5;

type SkillCardProps = {
  skill: Skill;
  onDelete: (id: string) => void;
  providers?: string[];
  className?: string;
};

export function SkillCard({
  skill,
  onDelete,
  providers = [],
  className,
}: SkillCardProps) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const editHref = routes.skillEditor.replace(":id", skill.id);
  const visibleProviders = providers.slice(0, MAX_VISIBLE_PROVIDER_BADGES);
  const hiddenProvidersCount = Math.max(
    providers.length - MAX_VISIBLE_PROVIDER_BADGES,
    0,
  );
  const toolsCount = getCapabilitySelectionTotal(
    skill.capabilityGroup?.items.map((item) => item.tools),
  );
  const promptsCount = getCapabilitySelectionTotal(
    skill.capabilityGroup?.items.map((item) => item.prompts),
  );

  function handleDownload(event: Event) {
    event.stopPropagation();
    downloadSkillMarkdown(skill);
  }

  return (
    <>
      <Card
        role="article"
        size="sm"
        onClick={() => navigate(editHref)}
        className={cn(
          "group relative flex min-h-[150px] cursor-pointer flex-col gap-0 rounded-xl border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container)] p-4 shadow-sm ring-0 transition hover:-translate-y-px hover:border-primary/40 hover:shadow-lg",
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

        <TooltipProvider>
          {/* Top: icon + name */}
          <div className="flex items-center gap-3 pr-12">
            <LetterAvatar name={skill.name} />
            <div className="min-w-0 flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="truncate text-[14.5px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text-colours-color-text-primary)]">
                    {skill.name}
                  </h3>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={4}
                  className="z-[9999] max-w-sm whitespace-normal"
                >
                  {skill.name}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Description */}
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="line-clamp-2 min-h-[40px] text-[13px] text-[var(--text-colours-color-text-secondary)]">
                {skill.description}
              </p>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={4}
              className="z-[9999] max-w-sm whitespace-normal"
            >
              {skill.description}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* MCP servers */}
        <div className="h-[74px] overflow-hidden">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-colours-color-text-tertiary)]">
            MCP Servers
          </p>
          {providers.length > 0 ? (
            <McpServerBadges>
              {visibleProviders.map((name) => (
                <McpServerBadge key={name} name={name} />
              ))}
              {hiddenProvidersCount > 0 ? (
                <span className="text-[11px] font-normal leading-[1.4] text-[var(--text-colours-color-text-primary)]">
                  +{hiddenProvidersCount}
                </span>
              ) : null}
            </McpServerBadges>
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
            {formatUpdatedAt(skill.updatedAt)}
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

function getCapabilitySelectionTotal(
  selections: Array<string[] | "*"> | undefined,
) {
  return (selections ?? []).reduce((total, selection) => {
    if (selection === "*") {
      return total;
    }
    return total + selection.length;
  }, 0);
}

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
