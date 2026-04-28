import type { Agent } from "@/types";

function normalizeAgent(agent: Agent) {
  return {
    id: agent.id,
    identifier: agent.identifier,
    sessionIds: [...agent.sessionIds],
    status: agent.status,
    lastActivity: agent.lastActivity ?? null,
    llm: agent.llm ?? null,
    usage: {
      callCount: agent.usage.callCount,
      lastCalledAt: agent.usage.lastCalledAt ?? null,
    },
  };
}

export function haveDashboardAgentsChanged(
  previous: Agent[],
  next: Agent[],
): boolean {
  if (previous.length !== next.length) return true;

  const previousSnapshot = [...previous]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(normalizeAgent);
  const nextSnapshot = [...next]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(normalizeAgent);

  return JSON.stringify(previousSnapshot) !== JSON.stringify(nextSnapshot);
}
