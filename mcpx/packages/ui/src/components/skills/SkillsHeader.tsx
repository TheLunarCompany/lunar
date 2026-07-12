import { LetterAvatar } from "@/components/LetterAvatar";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import * as SkillPage from "./SkillPage";

type SkillsHeaderBreadcrumb = {
  label: React.ReactNode;
  to?: string;
};

type SkillsHeaderProps = React.ComponentProps<"div"> & {
  title: string;
  avatarName?: string;
  breadcrumbs: SkillsHeaderBreadcrumb[];
  onBack: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  deleteDisabled?: boolean;
  editDisabled?: boolean;
};

export function SkillsHeader({
  title,
  avatarName = title,
  breadcrumbs,
  onBack,
  onDelete,
  onEdit,
  deleteDisabled = false,
  editDisabled = false,
  className,
  ...props
}: SkillsHeaderProps) {
  return (
    <SkillPage.Header
      className={cn(
        "-mx-6 -mt-6 w-auto border-b border-[var(--structure-color-border-primary)] bg-[var(--colors-gray-50)] px-6 py-3",
        className,
      )}
      {...props}
    >
      <SkillPage.HeaderText className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Back to skills"
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
        <LetterAvatar
          name={avatarName}
          className="size-9 rounded-lg text-base"
        />
        <div className="min-w-0">
          <Breadcrumbs items={breadcrumbs} />
          <SkillPage.Title className="mt-0.5 truncate text-sm leading-5">
            {title}
          </SkillPage.Title>
        </div>
      </SkillPage.HeaderText>

      <SkillPage.Actions>
        {onDelete ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Delete skill"
            disabled={deleteDisabled}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        ) : null}
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg px-3"
            disabled={editDisabled}
            onClick={onEdit}
          >
            <Pencil />
            Edit
          </Button>
        ) : null}
      </SkillPage.Actions>
    </SkillPage.Header>
  );
}
