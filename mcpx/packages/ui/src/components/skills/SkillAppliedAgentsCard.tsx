import type { SkillAgentOption } from "@/mapping/skill-agents";
import { scopeSubjectKey, type ScopeSubject } from "@mcpx/shared-model";
import { Bot } from "lucide-react";
import { SkillAgentIcon } from "./SkillAgentIcon";
import {
  SkillSidebarCardActionButton,
  SkillSidebarCardContent,
  SkillSidebarCardCount,
  SkillSidebarCardHeader,
  SkillSidebarCardIcon,
  SkillSidebarCardRoot,
  SkillSidebarCardRow,
  SkillSidebarCardTitle,
} from "./SkillSidebarCard";

export type SkillAppliedAgentsCardProps = {
  options: SkillAgentOption[];
  appliedSubjects: ScopeSubject[];
  loading?: boolean;
  error?: boolean;
  onManageAgents?: () => void;
};

export function SkillAppliedAgentsCard({
  options,
  appliedSubjects,
  loading = false,
  error = false,
  onManageAgents,
}: SkillAppliedAgentsCardProps) {
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
    <SkillSidebarCardRoot data-testid="applied-agents">
      <SkillSidebarCardHeader>
        <SkillSidebarCardTitle>Applied to agents</SkillSidebarCardTitle>
        <SkillSidebarCardCount>{appliedOptions.length}</SkillSidebarCardCount>
      </SkillSidebarCardHeader>

      <SkillSidebarCardContent>
        {loading ? (
          <StatusMessage>Loading agents…</StatusMessage>
        ) : error ? (
          <StatusMessage>Unable to load agents.</StatusMessage>
        ) : appliedOptions.length === 0 ? (
          <StatusMessage>No agents have this skill applied.</StatusMessage>
        ) : (
          appliedOptions.map((option) => (
            <SkillSidebarCardRow key={scopeSubjectKey(option.subject)}>
              <SkillSidebarCardIcon className="rounded-md bg-[var(--colors-gray-100)]">
                <SkillAgentIcon name={option.label} />
              </SkillSidebarCardIcon>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {!option.connected ? (
                  <span className="block truncate text-xs text-[var(--text-colours-color-text-secondary)]">
                    Not currently connected
                  </span>
                ) : null}
              </span>
            </SkillSidebarCardRow>
          ))
        )}
      </SkillSidebarCardContent>

      {onManageAgents ? (
        <SkillSidebarCardActionButton onClick={onManageAgents}>
          <Bot aria-hidden="true" />
          Manage agents
        </SkillSidebarCardActionButton>
      ) : null}
    </SkillSidebarCardRoot>
  );
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-2 text-sm text-[var(--text-colours-color-text-secondary)]">
      {children}
    </p>
  );
}
