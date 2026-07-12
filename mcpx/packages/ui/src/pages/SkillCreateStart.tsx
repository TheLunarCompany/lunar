import { SkillBreadcrumbTrail, SkillPage } from "@/components/skills";
import { getSkillBreadcrumbs } from "@/components/skills/skill-breadcrumbs";
import { toast } from "@/components/ui/use-toast";
import { parseSkillMarkdown } from "@/lib/skill-markdown";
import { routes } from "@/routes";
import type { SkillDraft } from "@mcpx/shared-model";
import { FileText, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export default function SkillCreateStart() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        title: "File is too large",
        description: "Choose a SKILL.md file up to 10 MB.",
        variant: "destructive",
      });
      return;
    }

    if (!file.name.toLowerCase().endsWith(".md")) {
      toast({
        title: "Upload a Markdown file",
        description: "Choose a .md file to create a skill.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsParsing(true);
      const parsed = parseSkillMarkdown(await file.text());
      const draft: SkillDraft = {
        name: parsed.name ?? "",
        description: parsed.description ?? "",
        body: parsed.body,
        exposeAsPrompt: true,
      };
      navigate(routes.skillNewUpload, { state: { draft } });
    } catch (error) {
      toast({
        title: "Could not parse skill file",
        description:
          error instanceof Error ? error.message : "Please try another file.",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFileChange(event.dataTransfer.files[0]);
  }

  return (
    <SkillPage.Root>
      <SkillPage.Container size="wide">
        <SkillPage.Header>
          <SkillPage.HeaderText>
            <SkillPage.Breadcrumbs>
              <SkillBreadcrumbTrail
                items={getSkillBreadcrumbs({ current: "Add new" })}
                showBackButton={false}
              />
            </SkillPage.Breadcrumbs>
            <SkillPage.Title>Add a new skill</SkillPage.Title>
            <SkillPage.Description>
              Upload a skill file from your computer, or start from a blank
              SKILL.md template.
            </SkillPage.Description>
          </SkillPage.HeaderText>
        </SkillPage.Header>

        <SkillPage.Content className="flex flex-col gap-6">
          <input
            ref={fileInputRef}
            aria-label="Upload skill file"
            type="file"
            accept=".md,text/markdown,text/plain"
            className="sr-only"
            onChange={(event) => {
              handleFileChange(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={isParsing}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              "flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container)] px-8 py-8 text-center shadow-sm transition",
              "hover:border-primary/50 hover:bg-[var(--structure-color-bg-container-overlay)]",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-50",
              isDragging ? "border-primary bg-primary/5" : "",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <FileUp className="size-7" />
            </span>
            <span className="mt-6 text-base font-semibold leading-6 text-[var(--text-colours-color-text-primary)]">
              Drag and drop your skill here, or{" "}
              <span className="text-primary underline underline-offset-4">
                browse files
              </span>
            </span>
            <span className="mt-2 max-w-3xl text-sm leading-5 text-[var(--text-colours-color-text-secondary)]">
              Upload a single SKILL.md file.
            </span>
            <span className="mt-5 flex flex-wrap justify-center gap-2">
              <UploadPill>SKILL.md</UploadPill>
            </span>
          </button>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5 text-sm font-semibold tracking-wide text-[var(--text-colours-color-text-secondary)]">
            <span className="h-px bg-[var(--structure-color-border-primary)]" />
            <span>OR</span>
            <span className="h-px bg-[var(--structure-color-border-primary)]" />
          </div>

          <CreateChoiceLink
            to={routes.skillNewBlank}
            icon={FileText}
            title="Start from blank"
            description="Write a SKILL.md manifest from scratch in the editor, including name, description, and instructions."
          />
        </SkillPage.Content>
      </SkillPage.Container>
    </SkillPage.Root>
  );
}

const choiceCardClassName =
  "flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container)] p-6 text-center no-underline shadow-sm transition hover:-translate-y-px hover:border-primary/40 hover:shadow-md";

function CreateChoiceLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className={choiceCardClassName}>
      <CreateChoiceContent
        icon={Icon}
        title={title}
        description={description}
      />
    </Link>
  );
}

function CreateChoiceContent({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-xl bg-[var(--structure-color-bg-container-overlay)] text-[var(--text-colours-color-text-primary)]"
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-5 text-[var(--text-colours-color-text-primary)]">
          {title}
        </span>
        <span className="mt-1.5 block text-sm leading-5 text-[var(--text-colours-color-text-secondary)]">
          {description}
        </span>
      </span>
    </>
  );
}

function UploadPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container-overlay)] px-3 py-1 font-mono text-sm text-[var(--text-colours-color-text-secondary)]">
      {children}
    </span>
  );
}
