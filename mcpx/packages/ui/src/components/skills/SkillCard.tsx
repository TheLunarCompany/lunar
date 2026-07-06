import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { routes } from "@/routes";
import type { Skill } from "@mcpx/shared-model";
import {
  Clock,
  Download,
  FileText,
  MoreVertical,
  Pencil,
  Terminal,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type SkillCardProps = {
  skill: Skill;
  onDelete: (id: string) => void;
  className?: string;
};

export function SkillCard({ skill, onDelete, className }: SkillCardProps) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const editHref = routes.skillEditor.replace(":id", skill.id);
  const hasCapabilityGroup = (skill.capabilityGroup?.items?.length ?? 0) > 0;

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

        {/* Top: icon + name + author */}
        <div className="flex items-start gap-3 pr-12">
          <div
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary"
          >
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[14.5px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text-colours-color-text-primary)]">
                {skill.name}
              </h3>
              {hasCapabilityGroup ? (
                <Badge
                  variant="secondary"
                  className="shrink-0 gap-1 rounded-md px-1.5 py-0 text-[10.5px] font-semibold"
                >
                  <Wrench className="size-3" />
                  Tools
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-colours-color-text-tertiary)]">
              <User className="size-3 opacity-70" />
              <span className="truncate">{skill.author.displayName}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-3 line-clamp-2 flex-1 text-[13px] text-[var(--text-colours-color-text-secondary)]">
          {skill.description}
        </p>

        {/* Footer */}
        <div className="mt-4 flex items-center gap-3 border-t border-[var(--structure-color-border-primary)] pt-3">
          {skill.exposeAsPrompt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Terminal className="size-3" />
              Slash command
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--structure-color-bg-container-overlay)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-colours-color-text-secondary)]">
              <FileText className="size-3" />
              Resource only
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-[var(--text-colours-color-text-tertiary)]">
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

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
