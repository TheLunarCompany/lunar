import {
  MarkdownEditor,
  SkillBreadcrumbTrail,
  SkillAppliedAgentsSummary,
  SkillIdentity,
  SkillLinkedCapabilities,
  SkillPage,
  SkillSetupSummary,
} from "@/components/skills";
import { getSkillBreadcrumbs } from "@/components/skills/skill-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useDeleteSkill, useEnabledSkills, useSkill } from "@/data/skills";
import { useGetMCPServers } from "@/data/catalog-servers";
import { buildSkillAgentSelection } from "@/mapping/skill-agents";
import { buildSkillCardCapabilitySummaryResolver } from "@/mapping/skills";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";
import { CircleAlert, CircleCheck, Trash2, Users, Unplug } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  generatePath,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

export default function SkillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const skillQuery = useSkill(id ?? "");
  const catalogServersQuery = useGetMCPServers();
  const deleteSkill = useDeleteSkill();
  const enabledSkillsQuery = useEnabledSkills();
  const systemState = useSocketStore((state) => state.systemState);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
  const capabilitySummary = useMemo(
    () =>
      buildSkillCardCapabilitySummaryResolver(
        systemState,
        catalogServersQuery.data,
      )(skill?.capabilityGroup),
    [catalogServersQuery.data, skill?.capabilityGroup, systemState],
  );
  const capabilityCount =
    capabilitySummary.toolsCount + capabilitySummary.promptsCount;
  const hasCapabilities = (skill?.capabilityGroup?.items.length ?? 0) > 0;
  const appliedAgentCount = skillAgentSelection.selected.length;
  const agentTabCount = enabledSkillsQuery.isLoading
    ? "…"
    : enabledSkillsQuery.isError
      ? "-"
      : appliedAgentCount;

  useEffect(() => {
    if (!skill || !location.hash) {
      return;
    }

    const targetId = decodeURIComponent(location.hash.slice(1));
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    });
  }, [location.hash, skill]);

  async function handleDelete() {
    if (!id) {
      return;
    }

    try {
      await deleteSkill.mutateAsync(id);
      setConfirmDeleteOpen(false);
      navigate(routes.skills);
    } catch (error) {
      toast({
        title: "Failed to delete skill",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <SkillPage.Root>
      <SkillPage.Container size="wide">
        <SkillPage.Header>
          <SkillPage.HeaderText>
            {skill ? (
              <SkillPage.Breadcrumbs>
                <SkillBreadcrumbTrail
                  items={getSkillBreadcrumbs({
                    id: skill.id,
                    skillName: skill.name,
                  })}
                />
              </SkillPage.Breadcrumbs>
            ) : null}
          </SkillPage.HeaderText>
        </SkillPage.Header>
        {skillQuery.isLoading ? (
          <SkillPage.Message title="Loading skill..." />
        ) : skillQuery.isError || !skill ? (
          <SkillPage.Message title="Skill not found.">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(routes.skills)}
            >
              Back to skills
            </Button>
          </SkillPage.Message>
        ) : (
          <SkillPage.Content className="flex min-w-0 flex-col gap-4">
            <SkillIdentity.Root
              name={skill.name}
              description={skill.description}
              maintainerName={skill.author.displayName}
              updatedAt={skill.updatedAt}
            >
              <SkillIdentity.Header>
                <SkillIdentity.Avatar />
                <SkillIdentity.Title as="h2" />
                <SkillIdentity.Actions>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Delete skill"
                    disabled={deleteSkill.isPending}
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 />
                  </Button>
                </SkillIdentity.Actions>
              </SkillIdentity.Header>
              <SkillIdentity.Description />
              <SkillIdentity.Meta>
                <SkillIdentity.Maintainer />
                <SkillIdentity.UpdatedAt />
              </SkillIdentity.Meta>
            </SkillIdentity.Root>
            <SkillSetupSummary.Root>
              <SkillSetupSummary.Card>
                <SkillSetupSummary.Icon className="bg-[var(--component-colours-color-fg-success)]">
                  <CircleCheck aria-hidden="true" className="size-4" />
                </SkillSetupSummary.Icon>
                <SkillSetupSummary.Content>
                  <SkillSetupSummary.Title>
                    Instructions
                  </SkillSetupSummary.Title>
                  <SkillSetupSummary.Description>
                    Added · SKILL.md
                  </SkillSetupSummary.Description>
                </SkillSetupSummary.Content>
                <SkillSetupSummary.Action>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Edit skill instructions"
                    onClick={() =>
                      navigate(
                        generatePath(routes.skillEditor, { id: skill.id }),
                      )
                    }
                  >
                    Edit
                  </Button>
                </SkillSetupSummary.Action>
              </SkillSetupSummary.Card>

              {hasCapabilities ? (
                <SkillSetupSummary.Card>
                  <SkillSetupSummary.Icon className="bg-[var(--component-colours-color-fg-success)]">
                    <CircleCheck aria-hidden="true" className="size-4" />
                  </SkillSetupSummary.Icon>
                  <SkillSetupSummary.Content>
                    <SkillSetupSummary.Title>
                      MCP capabilities
                    </SkillSetupSummary.Title>
                    <SkillSetupSummary.Description>
                      Added
                    </SkillSetupSummary.Description>
                  </SkillSetupSummary.Content>
                  <SkillSetupSummary.Action>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Edit MCP capabilities"
                      onClick={() =>
                        navigate(
                          generatePath(routes.skillCapabilities, {
                            id: skill.id,
                          }),
                        )
                      }
                    >
                      Edit
                    </Button>
                  </SkillSetupSummary.Action>
                </SkillSetupSummary.Card>
              ) : (
                <SkillSetupSummary.Card>
                  <SkillSetupSummary.Icon className="bg-[var(--colors-gray-100)] text-[var(--colors-gray-500)]">
                    <Unplug aria-hidden="true" className="size-4" />
                  </SkillSetupSummary.Icon>
                  <SkillSetupSummary.Content>
                    <div className="flex min-w-0 items-center gap-2">
                      <SkillSetupSummary.Title className="min-w-0 flex-1">
                        MCP capabilities
                      </SkillSetupSummary.Title>
                      <Badge
                        variant="ghost"
                        size="sm"
                        className="h-4 rounded-[4px] border-0 bg-[var(--colors-gray-100)] px-1.5 py-0 text-[9px] leading-none font-semibold tracking-[0.04em] text-[var(--colors-gray-500)]"
                      >
                        OPTIONAL
                      </Badge>
                    </div>
                    <SkillSetupSummary.Description>
                      optional for some skills
                    </SkillSetupSummary.Description>
                  </SkillSetupSummary.Content>
                  <SkillSetupSummary.Action>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Add MCP capabilities"
                      onClick={() =>
                        navigate(
                          generatePath(routes.skillCapabilities, {
                            id: skill.id,
                          }),
                        )
                      }
                    >
                      Add
                    </Button>
                  </SkillSetupSummary.Action>
                </SkillSetupSummary.Card>
              )}

              {enabledSkillsQuery.isLoading || enabledSkillsQuery.isError ? (
                <SkillSetupSummary.Card>
                  <SkillSetupSummary.Icon className="bg-[var(--colors-gray-100)] text-[var(--colors-gray-500)]">
                    <CircleAlert aria-hidden="true" className="size-4" />
                  </SkillSetupSummary.Icon>
                  <SkillSetupSummary.Content>
                    <SkillSetupSummary.Title>
                      Applied to agents
                    </SkillSetupSummary.Title>
                    <SkillSetupSummary.Description>
                      {enabledSkillsQuery.isLoading
                        ? "Loading agents…"
                        : "Unable to load agents."}
                    </SkillSetupSummary.Description>
                  </SkillSetupSummary.Content>
                  <SkillSetupSummary.Action>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Manage skill agents"
                      onClick={() =>
                        navigate(
                          generatePath(routes.skillAgents, { id: skill.id }),
                        )
                      }
                    >
                      Manage
                    </Button>
                  </SkillSetupSummary.Action>
                </SkillSetupSummary.Card>
              ) : appliedAgentCount > 0 ? (
                <SkillSetupSummary.Card>
                  <SkillSetupSummary.Icon className="bg-[var(--component-colours-color-fg-success)]">
                    <CircleCheck aria-hidden="true" className="size-4" />
                  </SkillSetupSummary.Icon>
                  <SkillSetupSummary.Content>
                    <SkillSetupSummary.Title>
                      Applied to agents
                    </SkillSetupSummary.Title>
                    <SkillSetupSummary.Description>
                      Applied
                    </SkillSetupSummary.Description>
                  </SkillSetupSummary.Content>
                  <SkillSetupSummary.Action>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Manage skill agents"
                      onClick={() =>
                        navigate(
                          generatePath(routes.skillAgents, { id: skill.id }),
                        )
                      }
                    >
                      Manage
                    </Button>
                  </SkillSetupSummary.Action>
                </SkillSetupSummary.Card>
              ) : (
                <SkillSetupSummary.Card>
                  <SkillSetupSummary.Icon className="bg-[var(--colors-gray-100)] text-[var(--colors-gray-500)]">
                    <Users aria-hidden="true" className="size-4" />
                  </SkillSetupSummary.Icon>
                  <SkillSetupSummary.Content>
                    <SkillSetupSummary.Title>
                      Applied to agents
                    </SkillSetupSummary.Title>
                    <SkillSetupSummary.Description className="text-[var(--component-colours-color-fg-warning)]">
                      Required to run
                    </SkillSetupSummary.Description>
                  </SkillSetupSummary.Content>
                  <SkillSetupSummary.Action>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Apply skill to agents"
                      onClick={() =>
                        navigate(
                          generatePath(routes.skillAgents, { id: skill.id }),
                        )
                      }
                    >
                      Apply
                    </Button>
                  </SkillSetupSummary.Action>
                </SkillSetupSummary.Card>
              )}
            </SkillSetupSummary.Root>
            <Tabs defaultValue="skill" className="min-w-0 gap-4">
              <TabsList
                variant="line"
                aria-label="Skill detail sections"
                className="gap-3"
              >
                <TabsTrigger value="skill" className="px-4">
                  Skill
                </TabsTrigger>
                <TabsTrigger value="mcp-capabilities" className="px-4">
                  MCP capabilities
                  <Badge
                    variant="secondary"
                    size="sm"
                    className="min-w-5 justify-center rounded-full border-[var(--structure-color-border-primary)]"
                  >
                    {capabilityCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="applied-agents" className="px-4">
                  Applied to agents
                  <Badge
                    variant="secondary"
                    size="sm"
                    className="min-w-5 justify-center rounded-full border-[var(--structure-color-border-primary)]"
                  >
                    {agentTabCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="skill" className="mt-0">
                <MarkdownEditor
                  id="skill-instructions"
                  mode="view"
                  value={skill.body}
                  onEdit={() =>
                    navigate(generatePath(routes.skillEditor, { id: skill.id }))
                  }
                />
              </TabsContent>
              <TabsContent value="mcp-capabilities" className="mt-0">
                <SkillLinkedCapabilities
                  id="linked-mcp-capabilities"
                  capabilityGroup={skill.capabilityGroup}
                  systemState={systemState}
                  catalogItems={catalogServersQuery.data}
                  showEmptyState
                  onEdit={() =>
                    navigate(
                      generatePath(routes.skillCapabilities, { id: skill.id }),
                    )
                  }
                />
              </TabsContent>
              <TabsContent value="applied-agents" className="mt-0">
                <SkillAppliedAgentsSummary
                  options={skillAgentSelection.options}
                  appliedSubjects={skillAgentSelection.selected}
                  loading={enabledSkillsQuery.isLoading}
                  error={enabledSkillsQuery.isError}
                  onEdit={() =>
                    navigate(generatePath(routes.skillAgents, { id: skill.id }))
                  }
                />
              </TabsContent>
            </Tabs>
          </SkillPage.Content>
        )}
      </SkillPage.Container>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete skill</DialogTitle>
            <DialogDescription className="break-words">
              This permanently deletes {skill?.name ?? "this skill"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSkill.isPending}
              onClick={handleDelete}
            >
              Delete skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SkillPage.Root>
  );
}
