import { MarkdownContent } from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SkillDraft } from "@mcpx/shared-model";
import { Code2, Eye, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { SkillSectionCard } from "./SkillSectionCard";
import {
  draftToFormValues,
  formValuesToDraft,
  skillFormSchema,
  type SkillFormValues,
} from "./skill-form-schema";

type SkillFormProps = {
  id?: string;
  defaultValues?: SkillDraft;
  submitLabel: string;
  showTopSubmit?: boolean;
  status?: "idle" | "submitting";
  onSubmit: (draft: SkillDraft) => Promise<void> | void;
  onDirtyChange?: (isDirty: boolean) => void;
  className?: string;
};

export function SkillForm({
  id,
  defaultValues,
  submitLabel,
  showTopSubmit = false,
  status = "idle",
  onSubmit,
  onDirtyChange,
  className,
}: SkillFormProps) {
  const [bodyMode, setBodyMode] = useState<"raw" | "preview">("raw");
  const formDefaultValues = draftToFormValues(defaultValues);
  const {
    handleSubmit,
    control,
    register,
    formState: { errors, isDirty },
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: formDefaultValues,
  });
  const bodyValue = useWatch({
    control,
    name: "body",
    defaultValue: formDefaultValues.body,
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const isSubmitting = status === "submitting";

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(formValuesToDraft(values));
    } catch {
      // parent surfaces the error via toast; keep the form populated
    }
  });

  return (
    <form
      id={id}
      onSubmit={submit}
      className={cn("flex h-full min-h-0 flex-col", className)}
    >
      {showTopSubmit ? (
        <div className="flex shrink-0 justify-end pb-3">
          <SubmitButton isSubmitting={isSubmitting} label={submitLabel} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 space-y-4 overflow-auto">
        <section
          aria-label="Skill details"
          className="space-y-5 rounded-xl border border-[var(--colors-purple-200)] bg-[var(--colors-white)] p-5 shadow-none"
        >
          <div className="space-y-2">
            <Label htmlFor="skill-name">Skill name</Label>
            <Input
              id="skill-name"
              aria-invalid={Boolean(errors.name)}
              className="bg-[var(--structure-color-bg-app)]"
              {...register("name")}
            />
            {errors.name ? <ErrorText>{errors.name.message}</ErrorText> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-description">Short description</Label>
            <Textarea
              id="skill-description"
              aria-invalid={Boolean(errors.description)}
              className="min-h-20 resize-y bg-[var(--structure-color-bg-app)]"
              {...register("description")}
            />
            {errors.description ? (
              <ErrorText>{errors.description.message}</ErrorText>
            ) : null}
          </div>
          <Controller
            name="exposeAsPrompt"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-app)] px-3 py-2">
                <Label htmlFor="skill-expose-as-prompt">Expose as prompt</Label>
                <Switch
                  id="skill-expose-as-prompt"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />
        </section>
        <div className="space-y-2">
          <SkillSectionCard
            icon={<FileText className="size-4" />}
            title="SKILL.md"
            description="single markdown file"
            actions={
              <Tabs
                value={bodyMode}
                onValueChange={(value) =>
                  setBodyMode(value === "preview" ? "preview" : "raw")
                }
              >
                <TabsList aria-label="Markdown body mode">
                  <TabsTrigger value="preview">
                    <Eye className="size-4" aria-hidden="true" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="raw">
                    <Code2 className="size-4" aria-hidden="true" />
                    Raw
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
            className="rounded-xl border-[var(--colors-purple-200)] bg-[var(--colors-white)] shadow-none"
            headerClassName="min-h-[72px] bg-[var(--colors-gray-50)] px-6 py-4"
            contentClassName={bodyMode === "raw" ? undefined : "p-7"}
          >
            {bodyMode === "raw" ? (
              <Textarea
                id="skill-body"
                aria-label="Markdown body"
                aria-invalid={Boolean(errors.body)}
                className="min-h-[640px] resize-y rounded-none border-0 bg-[var(--colors-white)] p-7 font-mono text-base leading-8 shadow-none focus-visible:ring-0 aria-invalid:!border-0 aria-invalid:!ring-0 dark:aria-invalid:!border-0 dark:aria-invalid:!ring-0"
                {...register("body")}
              />
            ) : (
              <>
                {bodyValue.trim() ? (
                  <MarkdownContent
                    content={bodyValue}
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
          {errors.body ? <ErrorText>{errors.body.message}</ErrorText> : null}
        </div>
      </div>
      <div className="flex shrink-0 justify-end px-5 py-4">
        <SubmitButton isSubmitting={isSubmitting} label={submitLabel} />
      </div>
    </form>
  );
}

function SubmitButton({
  isSubmitting,
  label,
}: {
  isSubmitting: boolean;
  label: string;
}) {
  return (
    <Button type="submit" disabled={isSubmitting}>
      {isSubmitting ? <Loader2 className="animate-spin" /> : null}
      {label}
    </Button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-destructive">{children}</p>;
}
