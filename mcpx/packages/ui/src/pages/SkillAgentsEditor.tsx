import {
  SkillAppliedAgents,
  SkillAppliedAgentsCard,
  SkillBreadcrumbTrail,
  SkillPage,
} from "@/components/skills";
import { getSkillBreadcrumbs } from "@/components/skills/skill-breadcrumbs";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  useEnabledSkills,
  useSkill,
  useUpdateSkillEnablement,
} from "@/data/skills";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import { buildSkillAgentSelection } from "@/mapping/skill-agents";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";
import type { ScopeSubject } from "@mcpx/shared-model";
import { useMemo, useState } from "react";
import { generatePath, useNavigate, useParams } from "react-router-dom";

export default function SkillAgentsEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const skillQuery = useSkill(id ?? "");
  const enabledSkillsQuery = useEnabledSkills();
  const updateSkillEnablement = useUpdateSkillEnablement();
  const systemState = useSocketStore((state) => state.systemState);
  const [isDirty, setIsDirty] = useState(false);
  const { allowNextNavigation } = useUnsavedChangesPrompt(isDirty);

  const skill = skillQuery.data;
  const skillAgentSelection = useMemo(
    () =>
      buildSkillAgentSelection({
        clusters: systemState?.connectedClientClusters ?? [],
        enabled: enabledSkillsQuery.data ?? [],
        skillId: skill?.id ?? "",
      }),
    [enabledSkillsQuery.data, skill?.id, systemState?.connectedClientClusters],
  );

  async function handleSave(next: ScopeSubject[]) {
    if (!skill) {
      return;
    }

    try {
      await updateSkillEnablement.mutateAsync({
        skillId: skill.id,
        previous: skillAgentSelection.selected,
        next,
      });
      toast({
        title: "Skill agents updated",
        description: "Skill access changes were saved.",
      });
      allowNextNavigation();
      navigate(generatePath(routes.skillDetail, { id: skill.id }));
    } catch (error) {
      toast({
        title: "Failed to update skill agents",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }

  function handleCancel() {
    if (!id) {
      navigate(routes.skills);
      return;
    }
    navigate(generatePath(routes.skillDetail, { id }));
  }

  return (
    <SkillPage.Root>
      <SkillPage.Container size="wide">
        <SkillPage.Header>
          <SkillPage.HeaderText>
            <SkillPage.Breadcrumbs>
              <SkillBreadcrumbTrail
                items={getSkillBreadcrumbs({
                  id,
                  skillName: skill?.name,
                  current: "Applied to agents",
                })}
              />
            </SkillPage.Breadcrumbs>
            <SkillPage.Title>Edit skill agents</SkillPage.Title>
            <SkillPage.Description>
              Choose which connected agents receive this skill.
            </SkillPage.Description>
          </SkillPage.HeaderText>
          <SkillPage.Actions>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </SkillPage.Actions>
        </SkillPage.Header>

        {skillQuery.isLoading ? (
          <EditorMessage title="Loading skill..." />
        ) : skillQuery.isError || !skill ? (
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
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
              <SkillAppliedAgentsCard
                options={skillAgentSelection.options}
                appliedSubjects={skillAgentSelection.selected}
                loading={enabledSkillsQuery.isLoading}
                error={enabledSkillsQuery.isError}
              />
            </div>
            <SkillAppliedAgents
              options={skillAgentSelection.options}
              appliedSubjects={skillAgentSelection.selected}
              loading={enabledSkillsQuery.isLoading}
              saving={updateSkillEnablement.isPending}
              error={enabledSkillsQuery.isError}
              emptyStateAction={
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg px-3"
                  onClick={() => navigate(routes.dashboard)}
                >
                  Go to dashboard
                </Button>
              }
              onDirtyChange={setIsDirty}
              onSave={handleSave}
            />
          </div>
        )}
      </SkillPage.Container>
    </SkillPage.Root>
  );
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
