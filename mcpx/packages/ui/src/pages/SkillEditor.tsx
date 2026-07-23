import { buildCapabilityProvidersFromCurrentTools } from "@/components/capabilities/current-tool-capabilities";
import { SkillFileStructureCard } from "@/components/skills/SkillFileStructureCard";
import { SkillLinkedCapabilitiesCard } from "@/components/skills/SkillLinkedCapabilitiesCard";
import {
  SkillAppliedAgentsCard,
  SkillBreadcrumbTrail,
  SkillForm,
  SkillPage,
} from "@/components/skills";
import { getSkillBreadcrumbs } from "@/components/skills/skill-breadcrumbs";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  useCreateSkill,
  useEnabledSkills,
  useSkill,
  useUpdateSkillDetails,
} from "@/data/skills";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import { routes } from "@/routes";
import { skillInputSchema, type SkillInput } from "@mcpx/shared-model";
import {
  addUnavailableSavedSkillCapabilities,
  buildLinkedCapabilityProviders,
  deriveSkillCapabilitySelectionState,
} from "@/mapping/skill-capabilities";
import { buildSkillAgentSelection } from "@/mapping/skill-agents";
import { useMemo, useState } from "react";
import {
  generatePath,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useSocketStore } from "@/store";

export default function SkillEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const uploadedDraft = useMemo(
    () => getUploadedDraft(location.state),
    [location.state],
  );

  const skillQuery = useSkill(id ?? "");
  const enabledSkillsQuery = useEnabledSkills();
  const catalogServersQuery = useGetMCPServers();
  const createSkill = useCreateSkill();
  const updateSkillDetails = useUpdateSkillDetails();
  const { appConfig, systemState } = useSocketStore((state) => ({
    appConfig: state.appConfig,
    systemState: state.systemState,
  }));
  const sourceDraft = isEdit ? skillQuery.data : uploadedDraft;
  const [isDetailsDirty, setIsDetailsDirty] = useState(false);
  const hasUploadedDraft = !isEdit && Boolean(uploadedDraft);
  const hasUnsavedDetails = isDetailsDirty || hasUploadedDraft;
  const { allowNextNavigation } = useUnsavedChangesPrompt(hasUnsavedDetails);

  async function handleSubmit(draft: SkillInput) {
    try {
      if (isEdit && id) {
        await updateSkillDetails.mutateAsync({ id, draft });
        allowNextNavigation();
        navigate(routes.skills);
      } else {
        const createdSkill = await createSkill.mutateAsync(draft);
        toast({
          title: "Skill created",
          description: "Skill details are ready.",
        });
        allowNextNavigation();
        navigate(generatePath(routes.skillDetail, { id: createdSkill.id }));
      }
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
    createSkill.isPending || updateSkillDetails.isPending
      ? "submitting"
      : "idle";
  const submitLabel = isEdit ? "Save changes" : "Create skill";
  const submitDisabled = status === "submitting" || !hasUnsavedDetails;
  const targetServers = useMemo(
    () => systemState?.targetServers ?? [],
    [systemState?.targetServers],
  );
  const capabilityProviders = useMemo(
    () =>
      buildCapabilityProvidersFromCurrentTools({
        targetServers,
        toolExtensionsServices: appConfig?.toolExtensions?.services,
      }),
    [appConfig?.toolExtensions?.services, targetServers],
  );
  const selectableCapabilityProviders = useMemo(
    () =>
      addUnavailableSavedSkillCapabilities({
        capabilityGroup: skillQuery.data?.capabilityGroup,
        targetServers,
        providers: capabilityProviders,
        catalogItems: catalogServersQuery.data,
      }),
    [
      capabilityProviders,
      catalogServersQuery.data,
      skillQuery.data?.capabilityGroup,
      targetServers,
    ],
  );
  const linkedCapabilityProviders = useMemo(() => {
    const { selectedKeys } = deriveSkillCapabilitySelectionState({
      capabilityGroup: skillQuery.data?.capabilityGroup,
      providers: selectableCapabilityProviders,
    });

    return buildLinkedCapabilityProviders({
      providers: selectableCapabilityProviders,
      selectedKeys,
    });
  }, [selectableCapabilityProviders, skillQuery.data?.capabilityGroup]);
  const skillAgentSelection = useMemo(
    () =>
      buildSkillAgentSelection({
        clusters: systemState?.connectedClientClusters ?? [],
        enabled: enabledSkillsQuery.data ?? [],
        skillId: skillQuery.data?.id ?? "",
      }),
    [
      enabledSkillsQuery.data,
      skillQuery.data?.id,
      systemState?.connectedClientClusters,
    ],
  );

  function navigateToCapabilities(providerName?: string) {
    if (!id) {
      return;
    }

    const path = generatePath(routes.skillCapabilities, { id });
    navigate(
      providerName ? `${path}?mcp=${encodeURIComponent(providerName)}` : path,
    );
  }

  return (
    <SkillPage.Root>
      <SkillPage.Container size={"wide"}>
        <SkillPage.Header>
          <SkillPage.HeaderText>
            <SkillPage.Breadcrumbs>
              <SkillBreadcrumbTrail
                items={getSkillBreadcrumbs({
                  id,
                  skillName: skillQuery.data?.name,
                  current: isEdit ? "Edit" : "Add new",
                })}
              />
            </SkillPage.Breadcrumbs>
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
              type="submit"
              form="skill-details-form"
              disabled={submitDisabled}
            >
              {submitLabel}
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
          <div className="flex min-w-0 flex-col gap-4">
            <div
              className={
                isEdit && skillQuery.data
                  ? "grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"
                  : undefined
              }
            >
              {isEdit && skillQuery.data ? (
                <div className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
                  <SkillFileStructureCard skillName={skillQuery.data.name} />
                  <SkillLinkedCapabilitiesCard
                    providers={linkedCapabilityProviders}
                    onProviderClick={(provider) =>
                      navigateToCapabilities(provider.name)
                    }
                    onLinkCapabilities={() => navigateToCapabilities()}
                  />
                  <SkillAppliedAgentsCard
                    options={skillAgentSelection.options}
                    appliedSubjects={skillAgentSelection.selected}
                    loading={enabledSkillsQuery.isLoading}
                    error={enabledSkillsQuery.isError}
                    onManageAgents={() =>
                      navigate(
                        generatePath(routes.skillAgents, {
                          id: skillQuery.data.id,
                        }),
                      )
                    }
                  />
                </div>
              ) : null}
              <SkillForm
                key={skillQuery.data?.id ?? uploadedDraft?.body ?? "new"}
                id="skill-details-form"
                submitLabel={submitLabel}
                submitDisabled={submitDisabled}
                status={status}
                defaultValues={sourceDraft}
                onSubmit={handleSubmit}
                onDirtyChange={setIsDetailsDirty}
              />
            </div>
          </div>
        )}
      </SkillPage.Container>
    </SkillPage.Root>
  );
}

function getUploadedDraft(state: unknown): SkillInput | undefined {
  if (!state || typeof state !== "object" || !("draft" in state)) {
    return undefined;
  }
  const parsed = skillInputSchema.safeParse(state.draft);
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
