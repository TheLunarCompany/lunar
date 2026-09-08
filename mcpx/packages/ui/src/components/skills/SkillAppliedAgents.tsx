import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/search-input";
import AgentCapabilitiesSvg from "@/icons/AgentCapabilities.svg?react";
import type { SkillAgentOption } from "@/mapping/skill-agents";
import { scopeSubjectKey, type ScopeSubject } from "@mcpx/shared-model";
import { Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SkillAgentIcon } from "./SkillAgentIcon";
import { SkillSectionCard } from "./SkillSectionCard";

export type SkillAppliedAgentsProps = {
  options: SkillAgentOption[];
  appliedSubjects: ScopeSubject[];
  loading?: boolean;
  saving?: boolean;
  error?: boolean;
  emptyStateAction?: React.ReactNode;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (next: ScopeSubject[]) => Promise<void>;
};

export function SkillAppliedAgents({
  options,
  appliedSubjects,
  loading = false,
  saving = false,
  error = false,
  emptyStateAction,
  onDirtyChange,
  onSave,
}: SkillAppliedAgentsProps) {
  const [query, setQuery] = useState("");
  const [baseline, setBaseline] = useState(appliedSubjects);
  const [draft, setDraft] = useState(appliedSubjects);
  const [savingInternally, setSavingInternally] = useState(false);
  const appliedSignature = subjectSetSignature(appliedSubjects);
  const lastAppliedIncomingSignature = useRef(appliedSignature);
  const dirty = !subjectSetsEqual(baseline, draft);
  const controlsDisabled = saving || savingInternally;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (lastAppliedIncomingSignature.current === appliedSignature) {
      return;
    }

    // A server refresh may arrive while the draft is dirty. Keep a divergent
    // draft intact, but accept the refresh when it already matches the draft:
    // the server has then reached the user's requested state safely.
    if (dirty && !subjectSetsEqual(appliedSubjects, draft)) {
      return;
    }

    lastAppliedIncomingSignature.current = appliedSignature;
    setBaseline(appliedSubjects);
    if (!subjectSetsEqual(appliedSubjects, draft)) {
      setDraft(appliedSubjects);
    }
  }, [appliedSignature, appliedSubjects, dirty, draft]);

  const selectedKeys = useMemo(
    () => new Set(draft.map(scopeSubjectKey)),
    [draft],
  );
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) =>
      [option.label, option.subject.value, subjectKindLabel(option.subject)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  const toggleSubject = (option: SkillAgentOption, checked: boolean) => {
    setDraft((current) => {
      const key = scopeSubjectKey(option.subject);
      if (checked) {
        return current.some((subject) => scopeSubjectKey(subject) === key)
          ? current
          : [...current, option.subject];
      }

      return current.filter((subject) => scopeSubjectKey(subject) !== key);
    });
  };

  const saveChanges = async () => {
    const next = [...draft];
    setSavingInternally(true);

    try {
      await onSave(next);
      setBaseline(next);
      setDraft(next);
    } catch {
      // Keep the draft dirty so the same changes can be retried.
    } finally {
      setSavingInternally(false);
    }
  };

  return (
    <SkillSectionCard
      icon={<Users className="size-4" />}
      title="Applied to agents"
      actions={
        <Button
          type="button"
          onClick={saveChanges}
          disabled={!dirty || controlsDisabled}
        >
          Save changes
        </Button>
      }
      contentClassName="p-4"
    >
      {loading ? (
        <StatusMessage>Loading agents…</StatusMessage>
      ) : error ? (
        <StatusMessage>Unable to load agents.</StatusMessage>
      ) : options.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span aria-hidden="true">
            <AgentCapabilitiesSvg className="h-40 w-auto" />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--text-colours-color-text-primary)]">
              No agents available.
            </h2>
            <p className="text-sm text-[var(--text-colours-color-text-secondary)]">
              Connect AI agents from the dashboard to apply this skill.
            </p>
          </div>
          {emptyStateAction}
        </div>
      ) : (
        <div className="space-y-3">
          <SearchInput
            role="searchbox"
            aria-label="Search agents"
            placeholder="Search agents..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={controlsDisabled}
          />

          {visibleOptions.length === 0 ? (
            <StatusMessage>No matching agents.</StatusMessage>
          ) : (
            <div className="divide-y divide-[var(--structure-color-border-primary)] overflow-hidden rounded-lg border border-[var(--structure-color-border-primary)]">
              {visibleOptions.map((option) => {
                const kindLabel = subjectKindLabel(option.subject);

                return (
                  <label
                    key={scopeSubjectKey(option.subject)}
                    className="flex cursor-pointer items-center gap-3 bg-[var(--structure-color-bg-container)] px-3 py-3 has-[:disabled]:cursor-not-allowed"
                  >
                    <Checkbox
                      checked={selectedKeys.has(
                        scopeSubjectKey(option.subject),
                      )}
                      onCheckedChange={(checked) =>
                        toggleSubject(option, checked === true)
                      }
                      disabled={controlsDisabled}
                      aria-label={`${option.label}, ${kindLabel}${option.connected ? "" : ", Not currently connected"}`}
                    />
                    <SkillAgentIcon name={option.label} className="size-6" />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--text-colours-color-text-primary)]">
                          {option.label}
                        </span>
                        {!option.connected ? (
                          <span className="block text-xs text-[var(--text-colours-color-text-secondary)]">
                            Not currently connected
                          </span>
                        ) : null}
                      </span>
                      <Badge variant="secondary">{kindLabel}</Badge>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
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

function subjectSetsEqual(a: ScopeSubject[], b: ScopeSubject[]): boolean {
  const aKeys = new Set(a.map(scopeSubjectKey));
  const bKeys = new Set(b.map(scopeSubjectKey));
  if (aKeys.size !== bKeys.size) return false;

  return [...aKeys].every((key) => bKeys.has(key));
}

function subjectSetSignature(subjects: ScopeSubject[]): string {
  return JSON.stringify([...new Set(subjects.map(scopeSubjectKey))].sort());
}
