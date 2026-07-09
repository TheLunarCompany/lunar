import {
  MarkdownEditor,
  SkillAnchorNavigation,
  SkillDetailSummary,
  SkillLinkedCapabilities,
  SkillPage,
  SkillsHeader,
} from "@/components/skills";
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
import { toast } from "@/components/ui/use-toast";
import { useDeleteSkill, useSkill } from "@/data/skills";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function SkillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const skillQuery = useSkill(id ?? "");
  const deleteSkill = useDeleteSkill();
  const systemState = useSocketStore((state) => state.systemState);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const skill = skillQuery.data;

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
      <SkillsHeader
        title={skill?.name ?? "Loading skill..."}
        avatarName={skill?.name ?? id ?? "Skill"}
        breadcrumbs={[
          { label: "Skills", to: routes.skills },
          { label: skill?.name ?? id ?? "Skill" },
        ]}
        className="mb-6"
        deleteDisabled={!skill || deleteSkill.isPending}
        onBack={() => navigate(routes.skills)}
        onDelete={() => setConfirmDeleteOpen(true)}
      />
      <SkillPage.Container size="wide">
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
          <SkillPage.Content className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
            <aside>
              <SkillAnchorNavigation
                className="mt-[100px] lg:sticky lg:top-[100px]"
                items={[
                  {
                    href: "#skill-instructions",
                    label: "SKILL.md",
                    icon: "file",
                  },
                  {
                    href: "#linked-mcp-capabilities",
                    label: "Linked MCP",
                    icon: "capabilities",
                  },
                ]}
              />
            </aside>
            <div className="flex min-w-0 flex-col gap-4">
              <SkillDetailSummary
                name={skill.name}
                description={skill.description}
                maintainerName={skill.author.displayName}
                updatedAt={skill.updatedAt}
              />
              <MarkdownEditor
                id="skill-instructions"
                mode="view"
                value={skill.body}
                onEdit={() =>
                  navigate(routes.skillEditor.replace(":id", skill.id))
                }
              />
              <SkillLinkedCapabilities
                id="linked-mcp-capabilities"
                capabilityGroup={skill.capabilityGroup}
                systemState={systemState}
                onEdit={() =>
                  navigate(routes.skillEditor.replace(":id", skill.id))
                }
              />
            </div>
          </SkillPage.Content>
        )}
      </SkillPage.Container>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete skill</DialogTitle>
            <DialogDescription>
              This permanently deletes {skill?.name ?? "this skill"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteSkill.isPending}
                onClick={handleDelete}
              >
                Delete skill
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SkillPage.Root>
  );
}
