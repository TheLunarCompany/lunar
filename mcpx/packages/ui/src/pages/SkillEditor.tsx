import { SkillForm, SkillPage } from "@/components/skills";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useCreateSkill, useSkill, useUpdateSkill } from "@/data/skills";
import { buildSkillToolGroupOptions } from "@/mapping/skills";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";
import { skillDraftSchema, type SkillDraft } from "@mcpx/shared-model";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function SkillEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const uploadedDraft = getUploadedDraft(location.state);
  const { appConfig, systemState } = useSocketStore((state) => ({
    appConfig: state.appConfig,
    systemState: state.systemState,
  }));

  const skillQuery = useSkill(id ?? "");
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const toolGroupOptions = useMemo(
    () => buildSkillToolGroupOptions({ appConfig, systemState }),
    [appConfig, systemState],
  );

  async function handleSubmit(draft: SkillDraft) {
    try {
      if (isEdit && id) {
        await updateSkill.mutateAsync({ id, draft });
      } else {
        await createSkill.mutateAsync(draft);
      }
      navigate(routes.skills);
    } catch (error) {
      toast({
        title: isEdit ? "Failed to update skill" : "Failed to create skill",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }

  const status =
    createSkill.isPending || updateSkill.isPending ? "submitting" : "idle";

  return (
    <SkillPage.Root>
      <SkillPage.Container size="form">
        <SkillPage.Header>
          <SkillPage.HeaderText>
            <SkillPage.Title>
              {isEdit ? "Edit skill" : "Add a new skill"}
            </SkillPage.Title>
            <SkillPage.Description>
              {isEdit
                ? "Update this personal Markdown skill."
                : "Save a personal Markdown skill."}
            </SkillPage.Description>
          </SkillPage.HeaderText>
          <SkillPage.Actions>
            <Button
              type="button"
              variant="outline"
              className="h-9 self-start rounded-lg px-3"
              onClick={() => navigate(routes.skills)}
            >
              <ArrowLeft />
              Back to skills
            </Button>
          </SkillPage.Actions>
        </SkillPage.Header>

        {isEdit && skillQuery.isLoading ? (
          <EditorMessage title="Loading skill..." />
        ) : isEdit && (skillQuery.isError || !skillQuery.data) ? (
          <EditorMessage title="Skill not found.">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(routes.skills)}
            >
              Back to skills
            </Button>
          </EditorMessage>
        ) : (
          <SkillForm
            key={skillQuery.data?.id ?? uploadedDraft?.body ?? "new"}
            submitLabel={isEdit ? "Save changes" : "Create skill"}
            status={status}
            defaultValues={isEdit ? skillQuery.data : uploadedDraft}
            toolGroupOptions={toolGroupOptions}
            onSubmit={handleSubmit}
          />
        )}
      </SkillPage.Container>
    </SkillPage.Root>
  );
}

function getUploadedDraft(state: unknown): SkillDraft | undefined {
  if (!state || typeof state !== "object" || !("draft" in state)) {
    return undefined;
  }
  const parsed = skillDraftSchema.safeParse(state.draft);
  return parsed.success ? parsed.data : undefined;
}

function EditorMessage({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid flex-1 place-items-center gap-4 p-5 text-sm text-[var(--text-colours-color-text-secondary)]">
      <span>{title}</span>
      {children}
    </div>
  );
}
