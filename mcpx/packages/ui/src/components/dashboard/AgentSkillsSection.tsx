import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  SkillProviderBadge,
  SkillProviderBadges,
} from "@/components/skills/SkillProviderBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { AgentDrawerSkill } from "@/mapping/agent-drawer";

export type AgentSkillsSectionProps = {
  skills: AgentDrawerSkill[];
  totalToolsCount: number;
  selectedSkillIds: ReadonlySet<string>;
  onSkillToggle: (skillId: string, checked: boolean) => void;
  loading?: boolean;
  error?: boolean;
  disabled?: boolean;
};

export function AgentSkillsSection({
  skills,
  totalToolsCount,
  selectedSkillIds,
  onSkillToggle,
  loading = false,
  error = false,
  disabled = false,
}: AgentSkillsSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return skills;

    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.providers.some((provider) =>
          provider.name.toLowerCase().includes(query),
        ),
    );
  }, [searchQuery, skills]);

  const handleFullAccessToggle = (checked: boolean) => {
    if (!checked) {
      const firstSkill = skills[0];
      if (firstSkill) onSkillToggle(firstSkill.id, true);
      return;
    }

    for (const skillId of selectedSkillIds) {
      onSkillToggle(skillId, false);
    }
  };

  return (
    <section
      aria-labelledby="agent-skills-heading"
      className="flex min-h-0 flex-1 flex-col"
    >
      <Separator className="my-5" />
      <h3
        id="agent-skills-heading"
        className="mb-3 text-base font-semibold leading-6 text-foreground"
      >
        Tools Access
      </h3>

      <div className="mb-3 flex shrink-0 items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
        <h3 className="text-sm font-semibold text-foreground">
          All Server Tools ({totalToolsCount})
        </h3>
        <Switch
          checked={selectedSkillIds.size === 0}
          onCheckedChange={handleFullAccessToggle}
          disabled={disabled || loading || error || skills.length === 0}
          aria-label="Use all server tools"
        />
      </div>

      <div className="mb-4 flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-muted/20 p-3">
        <div className="mb-3 shrink-0 text-sm font-semibold text-foreground">
          Skills
        </div>
        <SearchInput
          placeholder="Search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          wrapperClassName="mb-3 shrink-0"
          className="bg-background"
        />

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {loading ? (
            <StatusMessage>Loading skills…</StatusMessage>
          ) : error ? (
            <StatusMessage>Unable to load skills.</StatusMessage>
          ) : skills.length === 0 ? (
            <StatusMessage>No skills available.</StatusMessage>
          ) : filteredSkills.length === 0 ? (
            <StatusMessage>No skills found.</StatusMessage>
          ) : (
            filteredSkills.map((skill) => (
              <Card
                key={skill.id}
                className="gap-3 rounded-lg border-border bg-background py-3 shadow-xs ring-0 transition-colors hover:border-primary/30 hover:bg-muted/20"
              >
                <CardHeader className="px-3 py-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-semibold line-clamp-1">
                        <Link
                          to={skill.href}
                          className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {skill.name}
                        </Link>
                      </CardTitle>
                      <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                        {skill.description}
                      </p>
                    </div>
                    <Switch
                      checked={selectedSkillIds.has(skill.id)}
                      onCheckedChange={(checked) =>
                        onSkillToggle(skill.id, checked)
                      }
                      disabled={disabled}
                      aria-label={`Use ${skill.name}`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="px-3 py-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {skill.providers.length > 0 ? (
                      <SkillProviderBadges className="gap-1">
                        {skill.providers.map((provider) => (
                          <SkillProviderBadge
                            key={provider.name}
                            name={provider.name}
                            isMissingOrInactive={provider.isMissingOrInactive}
                            className="px-2 py-1 text-[11px]"
                          />
                        ))}
                      </SkillProviderBadges>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {formatCapabilityCount(
                        skill.toolsCount,
                        skill.promptsCount,
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function formatCapabilityCount(toolsCount: number, promptsCount: number) {
  const parts = [];
  if (toolsCount > 0 || promptsCount === 0) {
    parts.push(`${toolsCount} ${toolsCount === 1 ? "tool" : "tools"}`);
  }
  if (promptsCount > 0) {
    parts.push(`${promptsCount} ${promptsCount === 1 ? "prompt" : "prompts"}`);
  }
  return parts.join(" · ");
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-background px-3 py-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
