import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import {
  SkillProviderBadge,
  SkillProviderBadges,
} from "@/components/skills/SkillProviderBadge";
import type { AgentDrawerSkill } from "@/mapping/agent-drawer";

export type AgentSkillsSectionProps = {
  skills: AgentDrawerSkill[];
  loading?: boolean;
  error?: boolean;
};

export function AgentSkillsSection({
  skills,
  loading = false,
  error = false,
}: AgentSkillsSectionProps) {
  return (
    <section aria-labelledby="agent-skills-heading" className="mb-1 shrink-0">
      <h3
        id="agent-skills-heading"
        className="mb-3 text-base font-semibold leading-6 text-foreground"
      >
        Skills{!loading && !error ? ` (${skills.length})` : ""}
      </h3>

      {loading ? (
        <StatusMessage>Loading skills…</StatusMessage>
      ) : error ? (
        <StatusMessage>Unable to load skills.</StatusMessage>
      ) : skills.length === 0 ? (
        <StatusMessage>No skills assigned.</StatusMessage>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-background shadow-xs">
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="border-b border-border last:border-b-0"
            >
              <Link
                to={skill.href}
                className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                >
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-5 text-foreground">
                    {skill.name}
                  </span>
                  <span className="block truncate text-xs leading-4 text-muted-foreground">
                    {skill.description}
                  </span>
                  {skill.providers.length > 0 ? (
                    <SkillProviderBadges className="mt-2 gap-1">
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
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
