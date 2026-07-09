import { MarkdownContent } from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Pencil } from "lucide-react";
import { SkillSectionCard } from "./SkillSectionCard";

type MarkdownEditorMode = "view" | "edit";

type MarkdownEditorProps = React.ComponentProps<"section"> & {
  mode: MarkdownEditorMode;
  value: string;
  onChange?: (value: string) => void;
  onEdit?: () => void;
  textareaId?: string;
};

export function MarkdownEditor({
  mode,
  value,
  onChange,
  onEdit,
  textareaId,
  className,
  ...props
}: MarkdownEditorProps) {
  const isEditing = mode === "edit";

  return (
    <SkillSectionCard
      icon={<FileText className="size-4" />}
      title="SKILL.md"
      description="Instructions"
      actions={
        !isEditing && onEdit ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg px-3"
            onClick={onEdit}
          >
            <Pencil />
            Edit
          </Button>
        ) : null
      }
      className={className}
      contentClassName={isEditing ? undefined : "p-7"}
      {...props}
    >
      {isEditing ? (
        <Textarea
          id={textareaId}
          aria-label="Markdown body"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className="min-h-[420px] resize-y rounded-none border-0 bg-[var(--colors-gray-50)] p-7 font-mono text-sm shadow-none focus-visible:ring-0"
        />
      ) : (
        <>
          {value.trim() ? (
            <MarkdownContent
              content={value}
              className="text-[var(--text-colours-color-text-primary)] [&_h1]:!text-base [&_h1]:!leading-6 [&_h2]:!text-sm [&_h2]:!leading-5 [&_h3]:!text-sm [&_h3]:!leading-5"
            />
          ) : (
            <p className="text-sm text-[var(--text-colours-color-text-secondary)]">
              Nothing to preview.
            </p>
          )}
        </>
      )}
    </SkillSectionCard>
  );
}
