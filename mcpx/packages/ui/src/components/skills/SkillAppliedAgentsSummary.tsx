import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SkillAgentOption } from "@/mapping/skill-agents";
import { scopeSubjectKey, type ScopeSubject } from "@mcpx/shared-model";
import { Pencil, Users } from "lucide-react";
import { SkillAgentIcon } from "./SkillAgentIcon";
import { SkillSectionCard } from "./SkillSectionCard";

export type SkillAppliedAgentsSummaryProps = {
  options: SkillAgentOption[];
  appliedSubjects: ScopeSubject[];
  loading?: boolean;
  error?: boolean;
  onEdit: () => void;
};

export function SkillAppliedAgentsSummary({
  options,
  appliedSubjects,
  loading = false,
  error = false,
  onEdit,
}: SkillAppliedAgentsSummaryProps) {
  const optionsByKey = new Map(
    options.map((option) => [scopeSubjectKey(option.subject), option]),
  );
  const appliedOptions = appliedSubjects.map((subject) => {
    const option = optionsByKey.get(scopeSubjectKey(subject));
    return (
      option ?? {
        key: scopeSubjectKey(subject),
        subject,
        label: subject.value,
        connected: false,
      }
    );
  });

  return (
    <SkillSectionCard
      icon={<Users className="size-4" />}
      title="Applied to agents"
      actions={
        <Button type="button" variant="outline" onClick={onEdit}>
          <Pencil />
          Edit
        </Button>
      }
      contentClassName="p-4"
    >
      {loading ? (
        <StatusMessage>Loading agents…</StatusMessage>
      ) : error ? (
        <StatusMessage>Unable to load agents.</StatusMessage>
      ) : appliedOptions.length === 0 ? (
        <StatusMessage>No agents have this skill applied.</StatusMessage>
      ) : (
        <ul className="divide-y divide-[var(--structure-color-border-primary)] overflow-hidden rounded-lg border border-[var(--structure-color-border-primary)]">
          {appliedOptions.map((option) => (
            <li
              key={scopeSubjectKey(option.subject)}
              className="flex items-center justify-between gap-3 bg-[var(--structure-color-bg-container)] px-3 py-3"
            >
              <SkillAgentIcon name={option.label} className="size-6" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--text-colours-color-text-primary)]">
                  {option.label}
                </span>
                {!option.connected ? (
                  <span className="block text-xs text-[var(--text-colours-color-text-secondary)]">
                    Not currently connected
                  </span>
                ) : null}
              </span>
              <Badge variant="secondary">
                {subjectKindLabel(option.subject)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SkillSectionCard>
  );
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-[var(--text-colours-color-text-secondary)]">
      {children}
    </p>
  );
}

function subjectKindLabel(subject: ScopeSubject): string {
  return subject.kind === "consumerTag" ? "Consumer tag" : "Client name";
}
