import { Badge } from "@/components/ui/badge";
import { FileText, Folder } from "lucide-react";
import {
  SkillSidebarCardContent,
  SkillSidebarCardHeader,
  SkillSidebarCardIcon,
  SkillSidebarCardRoot,
  SkillSidebarCardRow,
  SkillSidebarCardTitle,
} from "./SkillSidebarCard";

type SkillFileStructureCardProps = {
  skillName: string;
};

const plannedFolders: { name: string; badge?: string }[] = [
  { name: "scripts/", badge: "Soon" },
  { name: "references/" },
  { name: "assets/" },
];

export function SkillFileStructureCard({
  skillName,
}: SkillFileStructureCardProps) {
  return (
    <SkillSidebarCardRoot data-testid="skill-file-structure">
      <SkillSidebarCardHeader>
        <SkillSidebarCardTitle>Skill file structure</SkillSidebarCardTitle>
      </SkillSidebarCardHeader>

      <SkillSidebarCardContent>
        <SkillSidebarCardRow>
          <SkillSidebarCardIcon className="text-[var(--colors-purple-600)]">
            <Folder className="size-4" aria-hidden="true" />
          </SkillSidebarCardIcon>
          <span className="min-w-0 flex-1 truncate font-semibold">
            {skillName}
          </span>
        </SkillSidebarCardRow>

        <SkillSidebarCardRow variant="active">
          <SkillSidebarCardIcon className="text-[var(--colors-purple-700)]">
            <FileText className="size-4" aria-hidden="true" />
          </SkillSidebarCardIcon>
          <span className="min-w-0 flex-1 truncate font-semibold">
            SKILL.md
          </span>
        </SkillSidebarCardRow>

        {plannedFolders.map((folder) => (
          <SkillSidebarCardRow key={folder.name} variant="muted">
            <SkillSidebarCardIcon>
              <Folder className="size-4" aria-hidden="true" />
            </SkillSidebarCardIcon>
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            {folder.badge ? (
              <Badge variant="secondary" size="sm">
                {folder.badge}
              </Badge>
            ) : null}
          </SkillSidebarCardRow>
        ))}
      </SkillSidebarCardContent>
    </SkillSidebarCardRoot>
  );
}
